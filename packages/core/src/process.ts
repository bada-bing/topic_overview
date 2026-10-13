// A process of the process manager, `proc`, addressed `<project>:<process>`.
// It runs in its project's tmux session, in a window named after it, whose
// first pane proc marks `running` or `exited` in @proc_state. The process
// name may hold a colon itself, as `dev:frontend` does, so the address is
// split at its first one, and the window is found by its exact name, as proc
// finds it, rather than given to tmux to resolve.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { StoreError } from "./store.ts";

const run = promisify(execFile);

export interface ProcessAddress {
  project: string;
  process: string;
}

export function processAddress(reference: string): ProcessAddress {
  const colon = reference.indexOf(":");
  if (colon <= 0 || colon === reference.length - 1) throw new StoreError(`a process is <project>:<process>, not ${reference}`);
  return { project: reference.slice(0, colon), process: reference.slice(colon + 1) };
}

// The id of the window running the process, or none when it has none.
export async function processWindow({ project, process }: ProcessAddress): Promise<string | undefined> {
  const { stdout } = await run("tmux", ["list-windows", "-t", `=${project}`, "-F", "#{window_id}\t#{window_name}"]).catch(() => ({ stdout: "" }));
  for (const line of stdout.split("\n")) {
    const [id, name] = line.split("\t");
    if (name === process) return id;
  }
  return undefined;
}

export type ProcessState = "running" | "exited" | "starting" | "not started";

// What the process is doing. A window proc has not marked yet is starting,
// as proc says while its shell has not reached the command.
export async function processState(address: ProcessAddress): Promise<ProcessState> {
  const window = await processWindow(address);
  if (!window) return "not started";
  const { stdout } = await run("tmux", ["list-panes", "-t", window, "-F", "#{@proc_state}"]);
  const marked = stdout.split("\n")[0];
  return marked === "running" || marked === "exited" ? marked : "starting";
}

// Starts the process through proc, or restarts it when it runs. proc
// replaces the process's window, so a terminal showing the old one is moved
// to the new one rather than left on whatever tmux shows next. proc runs in
// a login shell of its own, as from a fresh terminal, so a session it
// creates carries none of the server's environment, and in a process group
// of its own, so restarting the process the server runs in does not take
// proc down with it. What proc printed is the answer, and a failure says
// what proc said.
export async function startProcess(address: ProcessAddress): Promise<string> {
  const before = await processWindow(address);
  const watching = before ? await clientsOn(before) : [];
  const running = (await processState(address)) === "running";
  const args = ["start", address.process, "-p", address.project, ...(running ? ["-f"] : [])];
  try {
    return await proc(args);
  } finally {
    const after = await processWindow(address);
    if (after && after !== before) {
      for (const client of watching) await run("tmux", ["switch-client", "-c", client, "-t", after]).catch(() => undefined);
    }
  }
}

// The terminals showing a window.
async function clientsOn(window: string): Promise<string[]> {
  const { stdout } = await run("tmux", ["list-clients", "-F", "#{client_name}\t#{window_id}"]).catch(() => ({ stdout: "" }));
  return stdout
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([client, shown]) => client && shown === window)
    .map(([client]) => client);
}

// The environment a fresh terminal starts from, before its login shell adds
// the rest.
const LOGIN = ["HOME", "USER", "LOGNAME", "SHELL", "LANG", "TMPDIR", "TMUX_TMPDIR"];

function proc(args: string[]): Promise<string> {
  const env = Object.fromEntries(LOGIN.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])));
  const shell = process.env.SHELL ?? "/bin/zsh";
  return new Promise((resolve, reject) => {
    const child = spawn(shell, ["-lc", 'exec proc "$@"', "proc", ...args], { detached: true, env, stdio: ["ignore", "pipe", "pipe"] });
    let said = "";
    child.stdout.on("data", (chunk) => (said += chunk));
    child.stderr.on("data", (chunk) => (said += chunk));
    child.on("error", (failure) => reject(new StoreError(`proc could not be run: ${failure.message}`)));
    child.on("close", (code) => (code === 0 ? resolve(said.trim()) : reject(new StoreError(said.trim() || `proc failed with ${code}`))));
  });
}

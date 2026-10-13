// A process of the process manager, `proc`, addressed `<project>:<process>`.
// It runs in its project's tmux session, in a window named after it, whose
// first pane proc marks `running` or `exited` in @proc_state. The process
// name may hold a colon itself, as `dev:frontend` does, so the address is
// split at its first one, and the window is found by its exact name, as proc
// finds it, rather than given to tmux to resolve.

import { execFile } from "node:child_process";
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

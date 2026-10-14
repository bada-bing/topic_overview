// A browser integration: a page the view opens in a Chrome of its own, which
// speaks the Chrome DevTools Protocol on TOPIC_OVERVIEW_CDP_PORT on this
// machine, 9223 unless set. The view owns its tabs: it opens the page in the
// browser's window, one when there is none, and the discussion keeps the
// tab's id with how to reach it over CDP, so the page is that tab and no
// other, and an agent can attach to it and control it. When the browser is
// not running, it is started as the process TOPIC_OVERVIEW_BROWSER_PROCESS
// names, `<project>:<process>`. The view shows only whether the page is
// open; what happens inside it is the agent's to look at, over CDP.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { StoreError, type Tab, processAddress, startProcess } from "@topic-overview/core";

const run = promisify(execFile);

// How long a browser just started is waited for.
const STARTING = 15_000;

interface Target {
  id: string;
  type: string;
  url: string;
  title: string;
  webSocketDebuggerUrl?: string;
}

function port(): string {
  return process.env.TOPIC_OVERVIEW_CDP_PORT ?? "9223";
}

function endpoint(): string {
  return `http://127.0.0.1:${port()}`;
}

// The browser's tabs, or none when it is not running.
async function tabs(): Promise<Target[] | undefined> {
  try {
    const response = await fetch(`${endpoint()}/json/list`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return undefined;
    return ((await response.json()) as Target[]).filter((target) => target.type === "page");
  } catch {
    return undefined;
  }
}

// One call to the browser itself, rather than to a tab.
async function browserCall(method: string, params: object): Promise<Record<string, unknown>> {
  const version = (await (await fetch(`${endpoint()}/json/version`, { signal: AbortSignal.timeout(3_000) })).json()) as {
    webSocketDebuggerUrl: string;
  };
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  try {
    return await new Promise((resolve, reject) => {
      socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method, params })));
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (message.id !== 1) return;
        if (message.error) reject(new StoreError(`the browser refused ${method}: ${message.error.message}`));
        else resolve(message.result);
      });
      socket.addEventListener("error", () => reject(new StoreError("the browser could not be reached")));
    });
  } finally {
    socket.close();
  }
}

// Starts the browser when it is not running, and waits for it.
async function running(): Promise<void> {
  if (await tabs()) return;
  const address = process.env.TOPIC_OVERVIEW_BROWSER_PROCESS;
  if (!address) throw new StoreError(`no browser listens on ${endpoint()}, and none is configured to start`);
  await startProcess(processAddress(address));
  const until = Date.now() + STARTING;
  while (Date.now() < until) {
    if (await tabs()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new StoreError(`the browser did not start on ${endpoint()}`);
}

// Opens the page in a new tab of the browser's window, starting the browser
// first when it is not running, and gives the tab with how to reach it.
export async function openTab(url: string): Promise<Tab> {
  await running();
  const { targetId } = await browserCall("Target.createTarget", { url });
  const id = targetId as string;
  return { id, endpoint: endpoint(), webSocket: `ws://127.0.0.1:${port()}/devtools/page/${id}` };
}

// Brings the tab forward, and the browser to the front: the process
// listening on its port, since another Chrome may run beside it.
export async function focusTab(tab: string): Promise<void> {
  if (!(await tabs())?.some((target) => target.id === tab)) throw new StoreError("the tab is closed; open it again");
  await browserCall("Target.activateTarget", { targetId: tab });
  const { stdout } = await run("lsof", ["-t", "-nP", `-iTCP:${port()}`, "-sTCP:LISTEN"]).catch(() => ({ stdout: "" }));
  const pid = stdout.trim().split("\n")[0];
  if (pid) {
    await run("osascript", ["-e", `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`]);
  }
}

// Whether the page's tab is open and can be controlled over CDP. The tab's
// title is its name.
export async function browserState(id: string, tab: Tab | undefined): Promise<{ id: string; state: string; name?: string }> {
  const targets = await tabs();
  if (!targets) return { id, state: "not running" };
  const target = tab ? targets.find((known) => known.id === tab.id) : undefined;
  if (!target?.webSocketDebuggerUrl) return { id, state: "not open" };
  return { id, state: "open", name: target.title || target.url };
}

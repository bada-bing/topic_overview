// The state of a discussion's integrations, asked of the system each names.
// Only local processes are asked so far; the other kinds say so.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Integration } from "@topic-overview/core";

const run = promisify(execFile);

export interface IntegrationState {
  id: string;
  state: string; // running, exited, not started, unknown
  detail?: string;
}

// A local integration is a process of the process manager, named
// project:process. It runs in a tmux window of that name, whose pane the
// process manager marks running or exited.
async function localState(integration: Integration): Promise<IntegrationState> {
  try {
    const { stdout } = await run("tmux", ["display-message", "-p", "-t", integration.reference, "#{@proc_state}"]);
    const state = stdout.trim();
    return { id: integration.id, state: state || "not started" };
  } catch {
    return { id: integration.id, state: "not started", detail: `no window ${integration.reference}` };
  }
}

export async function integrationState(integration: Integration): Promise<IntegrationState> {
  if (integration.kind === "local") return localState(integration);
  return { id: integration.id, state: "unknown", detail: `${integration.kind} integrations are not asked yet` };
}

export async function integrationStates(integrations: Integration[]): Promise<IntegrationState[]> {
  return Promise.all(integrations.map(integrationState));
}

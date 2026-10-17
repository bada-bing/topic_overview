// The active work: what is being recorded right now, and for how long, read
// from the same scripts the tmux status bar reads, `get_active_work.sh` and
// `get_current_sitting.sh` in the folder TOPIC_OVERVIEW_STATUSBAR names.
// Without the folder, nothing is known about the work, and the page shows
// nothing of it.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export type WorkKind = "none" | "unlabelled" | "adhoc" | "task";

export interface Work {
  kind: WorkKind;
  identity?: string; // the task's key, or an adhoc's label
  step?: string; // a task's current step, when its page reports one
  now?: string; // the item marked NOW on that page
  elapsed?: string; // how long the open interval has run, as H:MM
}

export function statusbarRoot(): string | undefined {
  const configured = process.env.TOPIC_OVERVIEW_STATUSBAR;
  if (!configured) return undefined;
  return configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
}

// The four tab-separated fields get_active_work.sh prints, and the elapsed
// time get_current_sitting.sh prints, as one answer. An unknown kind is read
// as none rather than shown wrong.
export function parseActiveWork(line: string, elapsed: string): Work {
  const [kind, identity, step, now] = line.trimEnd().split("\t");
  const known: WorkKind = kind === "unlabelled" || kind === "adhoc" || kind === "task" ? kind : "none";
  const work: Work = { kind: known };
  if (identity) work.identity = identity;
  if (step) work.step = step;
  if (now) work.now = now;
  if (elapsed.trim()) work.elapsed = elapsed.trim();
  return work;
}

export async function activeWork(root: string | undefined = statusbarRoot()): Promise<Work | undefined> {
  if (!root) return undefined;
  const activeScript = join(root, "get_active_work.sh");
  const elapsedScript = join(root, "get_current_sitting.sh");
  if (!existsSync(activeScript) || !existsSync(elapsedScript)) return undefined;
  const [active, elapsed] = await Promise.all([run(activeScript), run(elapsedScript)]);
  return parseActiveWork(active.stdout, elapsed.stdout);
}

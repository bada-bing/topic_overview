// topic open <key> [--session <id>]
// Opens a discussion of a task's page on a branch of the knowledge base,
// checked out in a worktree beside it. Run by the agent in the tmux session it
// belongs to, so asks reach it through its pane. A topic already open is
// reported as it is. It prints the commit, the source file the agent reads,
// and the view.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { type Tmux, Topics } from "@topic-overview/core";

import { type Context, need, topicUrl } from "../context.ts";

const USAGE = "topic open <key> [--session <id>]";
const run = promisify(execFile);

export async function open([key]: string[], context: Context): Promise<void> {
  const topics = new Topics();
  const { topic, opened } = await topics.open(need(key, USAGE), context.session, await tmux());
  console.log(`${opened ? "opened" : "already open"} ${topic.key} on ${topic.branch} at ${await topics.head(topic.key)}`);
  console.log(`source  ${await topics.sourcePath(topic.key)}`);
  console.log(`view    ${topicUrl(topic.key)}`);
}

// The pane the command runs in, and its session. Outside tmux there is none.
async function tmux(): Promise<Tmux | undefined> {
  const pane = process.env.TMUX_PANE;
  if (!pane) return undefined;
  const { stdout } = await run("tmux", ["display-message", "-p", "-t", pane, "#S"]);
  return { session: stdout.trim(), pane };
}

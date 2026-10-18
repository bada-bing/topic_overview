// topic open <key> [--freestyle [<title>]]
// Opens a discussion of a task's page on a branch of the knowledge base,
// checked out in a worktree beside it. A topic already open is reported as
// it is. It prints the commit, the source file the agent reads, and the
// view. Who runs it does not matter: the discussion's agent is the first
// window of the tmux session named after the key, until `topic agent` says
// otherwise.
//
// --freestyle opens a topic with no task behind it: a page of its own,
// `pages/<key>.md`, created on the branch when there is none, titled as
// given or after the key, and an agent of its own in `discussions:<key>`,
// started there when the window is not there yet.

import { Topics } from "@topic-overview/core";

import { type Context, need, topicUrl } from "../context.ts";

const USAGE = "topic open <key> [--freestyle [<title>]]";

export async function open([key, title]: string[], context: Context): Promise<void> {
  const topics = new Topics();
  const freestyle = context.freestyle ? { title: title ?? need(key, USAGE) } : undefined;
  const { topic, opened } = await topics.open(need(key, USAGE), context.session, undefined, new Date(), freestyle);
  console.log(`${opened ? "opened" : "already open"} ${topic.key} on ${topic.branch} at ${await topics.head(topic.key)}`);
  console.log(`source  ${await topics.sourcePath(topic.key)}`);
  console.log(`view    ${topicUrl(topic.key)}`);
  if (context.freestyle) console.log(`agent   ${await topics.startFreestyleAgent(topic.key)}`);
}

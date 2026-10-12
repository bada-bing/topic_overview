// topic open <key>
// Opens a discussion of a task's page on a branch of the knowledge base,
// checked out in a worktree beside it. A topic already open is reported as
// it is. It prints the commit, the source file the agent reads, and the
// view. Who runs it does not matter: the discussion's agent is the first
// window of the tmux session named after the key, until `topic agent` says
// otherwise.

import { Topics } from "@topic-overview/core";

import { type Context, need, topicUrl } from "../context.ts";

const USAGE = "topic open <key>";

export async function open([key]: string[], context: Context): Promise<void> {
  const topics = new Topics();
  const { topic, opened } = await topics.open(need(key, USAGE), context.session);
  console.log(`${opened ? "opened" : "already open"} ${topic.key} on ${topic.branch} at ${await topics.head(topic.key)}`);
  console.log(`source  ${await topics.sourcePath(topic.key)}`);
  console.log(`view    ${topicUrl(topic.key)}`);
}

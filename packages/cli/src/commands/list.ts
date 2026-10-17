// topic list
// The open discussions: each topic's key, the branch it is on, and the view.

import { Topics } from "@topic-overview/core";

import { type Context, topicUrl } from "../context.ts";

export async function list(_args: string[], _context: Context): Promise<void> {
  const topics = new Topics();
  for (const topic of (await topics.list()).sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`${topic.key}  ${topic.branch} at ${await topics.head(topic.key)}  ${topicUrl(topic.key)}`);
  }
}

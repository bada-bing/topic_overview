// topic replace <key> <id> < content.md
// Replaces a block's content, its children included, with the block on
// stdin, written at depth 0. Its properties stay as they are.

import { Topics, replaceBlock } from "@topic-overview/core";

import { type Context, need, readBlock } from "../context.ts";

const USAGE = "topic replace <key> <id>";

export async function replace([key, id]: string[], _context: Context): Promise<void> {
  const block = need(id, USAGE);
  const input = await readBlock(USAGE);
  const topics = new Topics();
  const topic = need(key, USAGE);
  const head = await topics.change(topic, `Replace ${await topics.blockName(topic, block)}`, (text) => replaceBlock(text, block, input));
  console.log(`replaced ${block} at ${head}`);
}

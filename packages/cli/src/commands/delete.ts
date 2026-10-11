// topic delete <key> <id>
// Deletes a block with everything under it. A block others refer to is not
// deleted, since the references would point at nothing.

import { Topics, deleteBlock } from "@topic-overview/core";

import { type Context, need } from "../context.ts";

const USAGE = "topic delete <key> <id>";

export async function remove([key, id]: string[], _context: Context): Promise<void> {
  const block = need(id, USAGE);
  const topics = new Topics();
  const topic = need(key, USAGE);
  const head = await topics.change(topic, `Delete ${await topics.blockName(topic, block)}`, (text) => deleteBlock(text, block));
  console.log(`deleted ${block} at ${head}`);
}

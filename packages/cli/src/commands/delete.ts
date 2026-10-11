// topic delete <key> <id>
// Deletes a block with everything under it. A block others refer to is not
// deleted, since the references would point at nothing.

import { Topics, deleteBlock, placeOfDeleted } from "@topic-overview/core";

import { type Context, need } from "../context.ts";

const USAGE = "topic delete <key> <id>";

export async function remove([key, id]: string[], _context: Context): Promise<void> {
  const block = need(id, USAGE);
  const topics = new Topics();
  const topic = need(key, USAGE);
  // A deleted block is marked as removed, with what it read, since there is
  // no block left to mark; a mark it had goes with it.
  const removed = await topics.ownText(topic, block);
  const where = placeOfDeleted((await topics.source(topic)).text, block);
  await topics.clearMark(topic, block);
  const head = await topics.change(topic, `Delete ${await topics.blockName(topic, block)}`, (text) => deleteBlock(text, block), {
    text: removed,
    kind: "removed",
    ...where,
  });
  console.log(`deleted ${block} at ${head}`);
}

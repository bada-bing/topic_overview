// topic move <key> <id> --after|--before|--into <id>
// Moves a block with everything under it, carrying its own lines, so
// nothing of it is retyped.

import { Topics, moveBlock } from "@topic-overview/core";

import { type Context, need, needPlace } from "../context.ts";

const USAGE = "topic move <key> <id> --after|--before|--into <id>";

export async function move([key, id]: string[], context: Context): Promise<void> {
  const block = need(id, USAGE);
  const { place, address: target } = needPlace(context, USAGE);
  const topics = new Topics();
  const topic = need(key, USAGE);
  const description = `Move ${await topics.blockName(topic, block)} ${place} ${await topics.blockName(topic, target)}`;
  const head = await topics.change(topic, description, (text) => moveBlock(text, block, place, target));
  console.log(`moved ${block} at ${head}`);
}

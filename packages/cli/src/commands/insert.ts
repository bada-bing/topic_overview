// topic insert <key> --after|--before|--into <id> < block.md
// Inserts the block on stdin, written at depth 0, after or before a block,
// or into it as its last child. The new block gets an id, which is printed.

import { randomUUID } from "node:crypto";

import { Topics, insertBlock } from "@topic-overview/core";

import { type Context, need, needPlace, readBlock } from "../context.ts";

const USAGE = "topic insert <key> --after|--before|--into <id>";

export async function insert([key]: string[], context: Context): Promise<void> {
  const topic = need(key, USAGE);
  const { place, address: target } = needPlace(context, USAGE);
  const input = await readBlock(USAGE);
  const topics = new Topics();
  const id = randomUUID();
  const name = input.split("\n")[0].replace(/^- /, "");
  const description = `Insert "${name.length > 40 ? `${name.slice(0, 39)}…` : name}" ${place} ${await topics.blockName(topic, target)}`;
  const head = await topics.change(topic, description, (text) => insertBlock(text, place, target, input, id));
  await topics.recordId(topic, id);
  console.log(`inserted ${id} at ${head}`);
}

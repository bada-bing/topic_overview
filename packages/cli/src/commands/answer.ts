// topic answer <key> <question> < answer.md
// Answers a question I asked from the page about a block. The answer is
// shown beside the block, as written on stdin, until I dismiss it.

import { Topics } from "@topic-overview/core";

import { type Context, need, readBlock } from "../context.ts";

const USAGE = "topic answer <key> <question>";

export async function answer([key, id]: string[], _context: Context): Promise<void> {
  const question = need(id, USAGE);
  const text = await readBlock(USAGE);
  await new Topics().answer(need(key, USAGE), question, text);
  console.log(`answered ${question}`);
}

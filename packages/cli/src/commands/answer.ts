// topic answer <key> <question> [--suggest DONE|WAITING] < answer.md
// Answers a question I asked from the page about a block. The answer is
// shown beside the block, as written on stdin, until I dismiss it. A do's
// answer may suggest the marker its item should carry now, which I accept
// from the page or not.

import { type Suggestion, Topics } from "@topic-overview/core";

import { type Context, need, readBlock } from "../context.ts";

const USAGE = "topic answer <key> <question> [--suggest DONE|WAITING]";

export async function answer([key, id]: string[], context: Context): Promise<void> {
  const question = need(id, USAGE);
  const text = await readBlock(USAGE);
  await new Topics().answer(need(key, USAGE), question, text, new Date(), context.suggest as Suggestion | undefined);
  console.log(`answered ${question}`);
}

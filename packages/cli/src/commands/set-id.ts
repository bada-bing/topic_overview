// topic set-id <key> --line <n> --text <first line>
// Gives the block at the line an id, in a commit of its own, and prints it.
// The line and the block's first line must both match, so a stale one finds
// nothing rather than the wrong block. Every other command takes the id.

import { Topics } from "@topic-overview/core";

import { type Context, need, needLine } from "../context.ts";

const USAGE = "topic set-id <key> --line <n> --text <the block's first line>";

export async function setId([key]: string[], context: Context): Promise<void> {
  const { line, text } = needLine(context, USAGE);
  const { id, head, added } = await new Topics().setId(need(key, USAGE), line, text);
  console.log(added ? `${id} at ${head}` : `${id}, which it has already`);
}

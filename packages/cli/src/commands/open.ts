// topic open <source> <logseq-page.md> [--session <id>]
// Opens a discussion on a copy of the page, closing the one still open on it.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { convertLogseq } from "@topic-overview/core";

import { type Context, need, url } from "../context.ts";

const USAGE = "topic open <source> <logseq-page.md> [--session <id>]";

export async function open([source, path]: string[], context: Context): Promise<void> {
  const file = resolve(process.env.INIT_CWD ?? process.cwd(), need(path, USAGE));
  const pageMd = convertLogseq(await readFile(file, "utf8"));
  const ref = await context.store.open(need(source, USAGE), file, pageMd, context.session);
  console.log(`opened ${ref.source}/${ref.startedAt}\n${url(ref)}`);
}

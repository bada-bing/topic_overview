// topic save <source> <page.md> --from <version> --session <id>
// Saves the edited copy as the next version, which starts with no comments.
// --from names the version the copy was made from; a copy made from an
// outdated version is refused.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { type Context, need, openDiscussion, url } from "../context.ts";

const USAGE = "topic save <source> <page.md> --from <version> --session <id>";

export async function save([source, path]: string[], context: Context): Promise<void> {
  const ref = await openDiscussion(context, need(source, USAGE));
  const pageMd = await readFile(resolve(process.env.INIT_CWD ?? process.cwd(), need(path, USAGE)), "utf8");
  const from = need(context.from, USAGE);
  const version = await context.store.saveVersion(ref, pageMd, from, need(context.session, USAGE));
  console.log(`saved version ${version}\n${url(ref)}`);
}

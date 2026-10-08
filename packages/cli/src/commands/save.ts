// topic save <source> <page.md | directory> --from <version> --session <id>
// Saves the edited copy as the next version, which starts with no comments.
// A directory holds page.md and, when it brings attachments, attachments/.
// --from names the version the copy was made from; a copy made from an
// outdated version is refused.

import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { type Context, need, openDiscussion, url } from "../context.ts";

const USAGE = "topic save <source> <page.md | directory> --from <version> --session <id>";

export async function save([source, path]: string[], context: Context): Promise<void> {
  const ref = await openDiscussion(context, need(source, USAGE));
  const given = resolve(process.env.INIT_CWD ?? process.cwd(), need(path, USAGE));
  const isDirectory = (await stat(given)).isDirectory();
  const pageMd = await readFile(isDirectory ? join(given, "page.md") : given, "utf8");
  const attachments = isDirectory ? await stat(join(given, "attachments")).then(() => join(given, "attachments"), () => undefined) : undefined;
  const from = need(context.from, USAGE);
  const version = await context.store.saveVersion(ref, pageMd, from, need(context.session, USAGE), attachments);
  console.log(`saved version ${version}\n${url(ref)}`);
}

// topic status <source>
// The open discussion of a source, without joining it as resume does: where
// it is shown, its version and comments, the files an agent reads, and
// whether its source changed since it opened.

import { join } from "node:path";

import { sourceChanged } from "@topic-overview/core";

import { type Context, need, openDiscussion, url } from "../context.ts";

export async function status([source]: string[], context: Context): Promise<void> {
  const ref = await openDiscussion(context, need(source, "topic status <source>"));
  const { discussion } = await context.store.read(ref);
  const dir = context.store.directory(ref);
  console.log(`${url(ref)}\nversion ${discussion.version}, ${discussion.annotations.length} open comments`);
  console.log(`files: ${join(dir, "discussion.json")} and ${join(dir, "page.md")}`);
  if (await sourceChanged(discussion.source, discussion.sourceHash)) console.log("the source has changed since the discussion opened; refresh the discussion from it");
}

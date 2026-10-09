// topic resume <source> --session <id>
// Rejoins the open discussion of a source, recording the session.

import { sourceChanged } from "@topic-overview/core";

import { type Context, need, url } from "../context.ts";

const USAGE = "topic resume <source> --session <id>";

export async function resume([source]: string[], context: Context): Promise<void> {
  const ref = await context.store.resume(need(source, USAGE), need(context.session, USAGE));
  const { discussion } = await context.store.read(ref);
  console.log(`${url(ref)}\nversion ${discussion.version}, ${discussion.annotations.length} open comments`);
  if (await sourceChanged(discussion.source, discussion.sourceHash)) {
    console.log(`the source has changed since the discussion opened; refresh the discussion from it with: topic open ${ref.source} ${discussion.source}`);
  }
}

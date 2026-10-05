// topic resume <source> --session <id>
// Rejoins the open discussion of a source, recording the session.

import { type Context, need, url } from "../context.ts";

const USAGE = "topic resume <source> --session <id>";

export async function resume([source]: string[], context: Context): Promise<void> {
  const ref = await context.store.resume(need(source, USAGE), need(context.session, USAGE));
  const { discussion } = await context.store.read(ref);
  console.log(`${url(ref)}\nversion ${discussion.version}, ${discussion.annotations.length} open comments`);
}

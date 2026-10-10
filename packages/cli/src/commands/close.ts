// topic close <source> [--session <id>]
// Closes the open discussion of a source; it is read-only from then on.

import { type Context, need, openDiscussion } from "../context.ts";

export async function close([source]: string[], context: Context): Promise<void> {
  const ref = await openDiscussion(context, need(source, "topic close <source> [--session <id>]"));
  await context.store.close(ref, "on-demand", context.session);
  console.log(`closed ${ref.source}/${ref.startedAt}`);
}

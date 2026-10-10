// topic list [<source>]
// Without a source, the open discussions; with one, all of its discussions.

import { readdir } from "node:fs/promises";

import { stateText } from "@topic-overview/core";

import { type Context, url } from "../context.ts";

export async function list([source]: string[], context: Context): Promise<void> {
  const sources = source ? [source] : await readdir(context.store.root).catch(() => []);
  for (const name of sources.sort()) {
    for (const ref of await context.store.discussionsOf(name)) {
      const { discussion } = await context.store.read(ref);
      if (!source && discussion.closed) continue;
      const state = discussion.closed ? stateText(discussion) : `open, version ${discussion.version}`;
      console.log(`${ref.source}/${ref.startedAt}  ${state}  ${url(ref)}`);
    }
  }
}

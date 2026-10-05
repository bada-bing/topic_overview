// Converts a Logseq page into page.md. A block keeps the id Logseq gave it
// with `id::`, so `((uuid))` references still resolve; every other block is
// numbered by its position, b1 to bn.

import { type Page, parsePage, serializePage, walk } from "./page.ts";

export function convertLogseq(text: string): string {
  const page: Page = parsePage(text);
  const taken = new Set([...walk(page.blocks)].map((block) => block.id).filter(Boolean));
  let next = 1;
  for (const block of walk(page.blocks)) {
    if (block.id) continue;
    while (taken.has(`b${next}`)) next += 1;
    block.id = `b${next}`;
    taken.add(block.id);
  }
  return serializePage(page);
}

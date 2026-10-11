// Converts a Logseq page into page.md. A block keeps the id Logseq gave it
// with `id::`, so `((uuid))` references still resolve; every other block is
// numbered by its position, b1 to bn.

import { type Block, type Page, parsePage, serializePage, walk } from "./page.ts";

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

// Numbers the blocks without an id by their place: b3.2.5 is the fifth
// child of the second child of the third block at the top. An edit then
// renumbers only the blocks after it under the same parent, so the view can
// keep every other block as it was. Nothing is written back to the source.
export function numberByPlace(blocks: Block[], prefix = "b"): void {
  blocks.forEach((block, index) => {
    const place = `${prefix}${prefix === "b" ? "" : "."}${index + 1}`;
    if (!block.id) block.id = place;
    numberByPlace(block.children, place);
  });
}

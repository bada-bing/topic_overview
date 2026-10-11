// Sections and the outline of a page. A section is a top-level block that
// has children; it folds as a whole. Its headings, at any depth, are the
// outline's entries under it.

import type { Block } from "@topic-overview/core";

export interface OutlineEntry {
  id: string;
  text: string;
  depth: number; // 0 for a section, 1 and deeper for the headings inside it
}

export function isSection(block: Block): boolean {
  return block.children.length > 0;
}

export function outline(blocks: Block[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const headings = (children: Block[], depth: number) => {
    for (const child of children) {
      if (child.kind === "heading") entries.push({ id: child.id, text: child.text, depth });
      headings(child.children, child.kind === "heading" ? depth + 1 : depth);
    }
  };
  for (const block of blocks) {
    if (!isSection(block)) continue;
    entries.push({ id: block.id, text: block.text, depth: 0 });
    headings(block.children, 1);
  }
  return entries;
}

// Which section every block belongs to, so a jump to any block opens it.
export function sectionOf(blocks: Block[]): Map<string, string> {
  const owner = new Map<string, string>();
  const mark = (children: Block[], section: string) => {
    for (const child of children) {
      owner.set(child.id, section);
      mark(child.children, section);
    }
  };
  for (const block of blocks) {
    if (!isSection(block)) continue;
    owner.set(block.id, block.id);
    mark(block.children, block.id);
  }
  return owner;
}

// The blocks of a section whose children show while one heading inside it is
// chosen: the headings on the way down to it, and everything under it. Every
// other block shows its own line only. Choosing the section itself narrows
// nothing, and gives undefined.
export function unfolded(section: Block, chosen: string): Set<string> | undefined {
  if (chosen === section.id) return undefined;
  const shown = new Set<string>();
  const all = (block: Block) => {
    shown.add(block.id);
    block.children.forEach(all);
  };
  const find = (block: Block): boolean => {
    if (block.id === chosen) {
      all(block);
      return true;
    }
    if (!block.children.some(find)) return false;
    shown.add(block.id);
    return true;
  };
  return find(section) ? shown : undefined;
}

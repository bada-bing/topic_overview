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

// What folds on a page: a section, and a heading with something under it.
// One set says which of them are unfolded, and every way of folding, from
// the outline, a section's heading or a subsection's heading, changes it
// through toggleFold, so each has the same effect. One thing is open at a
// time: the set is the way down to it. What is open shows whole, and
// everything beside the way to it is folded.
export function foldsBlock(block: Block, depth: number): boolean {
  return block.children.length > 0 && (depth === 0 || block.kind === "heading");
}

// The folds on the way down to a block: its section, the headings around it,
// and the block itself when it folds. Undefined for a block not on the page.
export function foldPath(blocks: Block[], id: string): string[] | undefined {
  const find = (children: Block[], depth: number): string[] | undefined => {
    for (const block of children) {
      const own = foldsBlock(block, depth) ? [block.id] : [];
      if (block.id === id) return own;
      const below = find(block.children, depth + 1);
      if (below) return [...own, ...below];
    }
    return undefined;
  };
  return find(blocks, 0);
}

// Opening a block, which folds everything beside the way to it, or, when it
// is what is open, folding everything, as the page starts.
export function toggleFold(blocks: Block[], unfolded: Set<string>, id: string): Set<string> {
  return innermost(blocks, unfolded) === id ? new Set() : reveal(blocks, id);
}

// What shows unfolded: the way down to what is open, and everything under it.
export function shownUnfolded(blocks: Block[], unfolded: Set<string>): Set<string> {
  const shown = new Set(unfolded);
  const open = innermost(blocks, unfolded);
  const all = (block: Block, depth: number) => {
    if (foldsBlock(block, depth)) shown.add(block.id);
    for (const child of block.children) all(child, depth + 1);
  };
  const find = (children: Block[], depth: number) => {
    for (const block of children) {
      if (block.id === open) return all(block, depth);
      find(block.children, depth + 1);
    }
  };
  if (open) find(blocks, 0);
  return shown;
}

// The way down to a block unfolded, and nothing else, as a jump to it does.
export function reveal(blocks: Block[], id: string): Set<string> {
  return new Set(foldPath(blocks, id) ?? []);
}

// The innermost of what is unfolded: what was opened last.
export function innermost(blocks: Block[], unfolded: Set<string>): string | undefined {
  let deepest: string | undefined;
  let depth = -1;
  for (const id of unfolded) {
    const length = foldPath(blocks, id)?.length ?? 0;
    if (length > depth) [deepest, depth] = [id, length];
  }
  return deepest;
}

// What stays the same of a section or heading when the content around it
// changes: the texts of the headings down to it, its own included. The view
// keeps what is open by these, so an edit that renumbers the blocks leaves
// open what was open, and a heading that is gone simply closes.
export function headingKeys(blocks: Block[]): Map<string, string> {
  const keys = new Map<string, string>();
  const visit = (children: Block[], depth: number, path: string[]) => {
    for (const block of children) {
      const named = depth === 0 || block.kind === "heading";
      const own = named ? [...path, block.text] : path;
      if (named) keys.set(block.id, own.join("\u0000"));
      visit(block.children, depth + 1, own);
    }
  };
  visit(blocks, 0, []);
  return keys;
}

// A section or heading as the URL names it: its block's id when it has one,
// since that stays put, and otherwise the path of headings down to it, each
// written plainly, such as `problem/use-cases`. The view's numbers, which an
// edit above shifts, never name a place in the URL. Two headings on the same
// path are named alike, and the URL leads to the first.
export function placeName(blocks: Block[], id: string): string {
  if (UUID.test(id)) return id;
  const key = headingKeys(blocks).get(id);
  return key === undefined ? id : key.split("\u0000").map(plain).join("/");
}

// The block a name from the URL leads to: a block with that id, or the first
// heading on that path. A name that leads nowhere leads nowhere.
export function namedPlace(blocks: Block[], name: string): string | undefined {
  const known = (children: Block[]): boolean => children.some((block) => block.id === name || known(block.children));
  if (known(blocks)) return name;
  for (const [id] of headingKeys(blocks)) if (placeName(blocks, id) === name) return id;
  return undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// A heading's text as a part of a URL: lowercase letters and digits, words
// joined by hyphens, markers such as an emoji dropped.
function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

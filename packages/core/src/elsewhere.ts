// Blocks a page refers to with ((id)) that live on another page of the
// knowledge base, as Logseq allows: found by their `id::` property in the
// pages and journals of the discussion's worktree, which holds the whole
// knowledge base at the discussion's branch. Which file holds which ids is
// kept, and a file is read again only when it changed, so a view is not
// slowed by reading the knowledge base every time.

import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { numberByPlace } from "./logseq.ts";
import { type Block, parsePage, walk } from "./page.ts";

export interface ElsewhereBlock {
  page: string; // the page's name, such as SOA/Errands, or a journal's date
  journal: boolean;
  block: Block; // with everything under it
}

const FOLDERS = ["pages", "journals"];
const ID = /^\s*id:: ?(\S+)\s*$/gm;

const indexes = new Map<string, Map<string, { modified: number; ids: Set<string> }>>();

// The files under the root holding each of the ids.
async function locate(root: string, wanted: Set<string>): Promise<Map<string, string>> {
  const index = indexes.get(root) ?? new Map<string, { modified: number; ids: Set<string> }>();
  indexes.set(root, index);
  const present = new Set<string>();
  for (const folder of FOLDERS) {
    const names = await readdir(join(root, folder)).catch(() => [] as string[]);
    for (const name of names.filter((entry) => entry.endsWith(".md"))) {
      const file = join(root, folder, name);
      present.add(file);
      const modified = (await stat(file)).mtimeMs;
      if (index.get(file)?.modified === modified) continue;
      const text = await readFile(file, "utf8");
      index.set(file, { modified, ids: new Set([...text.matchAll(ID)].map((match) => match[1])) });
    }
  }
  const found = new Map<string, string>();
  for (const [file, { ids }] of index) {
    if (!present.has(file)) {
      index.delete(file);
      continue;
    }
    for (const id of ids) if (wanted.has(id)) found.set(id, file);
  }
  return found;
}

// A page's name as Logseq gives it: the file's name, with a slash written
// %2F; a journal is named by its date, 2026_10_14 as 2026-10-14.
function nameOf(file: string): { page: string; journal: boolean } {
  const name = basename(file, ".md");
  if (basename(dirname(file)) === "journals") return { page: name.replaceAll("_", "-"), journal: true };
  return { page: name.replaceAll("%2F", "/"), journal: false };
}

// The blocks with these ids found on the knowledge base's other pages,
// each with its page. An id found nowhere is left out.
export async function blocksElsewhere(root: string, ids: Iterable<string>): Promise<Record<string, ElsewhereBlock>> {
  const wanted = new Set(ids);
  const resolved: Record<string, ElsewhereBlock> = {};
  if (wanted.size === 0) return resolved;
  const byFile = new Map<string, string[]>();
  for (const [id, file] of await locate(root, wanted)) byFile.set(file, [...(byFile.get(file) ?? []), id]);
  for (const [file, ids] of byFile) {
    // Blocks without an id are numbered by their place, as on the view's own
    // page, so each can be told apart when shown.
    const page = parsePage(await readFile(file, "utf8"));
    numberByPlace(page.blocks);
    for (const block of walk(page.blocks)) {
      if (ids.includes(block.id)) resolved[block.id] = { ...nameOf(file), block };
    }
  }
  return resolved;
}

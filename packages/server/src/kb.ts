// The Logseq knowledge base the server reads referenced pages from, set as
// TOPIC_OVERVIEW_KB in .env. Files are read fresh on every request.

import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

import { type Page, convertLogseq, parsePage } from "@topic-overview/core";

export interface PagePreview {
  name: string;
  properties: Record<string, string>;
  lines: string[];
}

export class KbError extends Error {}

const PREVIEW_LINES = 3;

function kbPages(): string {
  const configured = process.env.TOPIC_OVERVIEW_KB;
  if (!configured) throw new KbError("no knowledge base is configured");
  const root = configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
  return join(root, "pages");
}

// Logseq writes a page named `a/b` as `a%2Fb.md`, and matches names without
// regard to case.
async function pageFile(name: string): Promise<string> {
  const pages = kbPages();
  const wanted = `${name.replaceAll("/", "%2F")}.md`.toLowerCase();
  const file = (await readdir(pages)).find((entry) => entry.toLowerCase() === wanted);
  if (!file) throw new KbError(`there is no page ${name}`);
  const path = resolve(pages, file);
  if (!path.startsWith(pages + sep)) throw new KbError(`${name} resolves outside the knowledge base`);
  return path;
}

export async function readKbPage(name: string): Promise<Page> {
  return parsePage(convertLogseq(await readFile(await pageFile(name), "utf8")));
}

export async function previewKbPage(name: string): Promise<PagePreview> {
  const page = await readKbPage(name);
  const properties: Record<string, string> = {};
  for (const line of page.frontmatter.split("\n")) {
    const match = /^([\w-]+):\s*(.+)$/.exec(line);
    if (match) properties[match[1]] = match[2].trim();
  }
  const lines = page.blocks.slice(0, PREVIEW_LINES).map((block) => block.text.split("\n")[0]);
  return { name, properties, lines };
}

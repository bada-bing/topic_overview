// A markdown file of the knowledge base's assets/, such as a task's working
// plan or a table of findings, split into what the page draws: headings,
// list items, paragraphs, tables and fenced code blocks. Each line keeps its
// inline markdown, rendered as a block's is.

import { type Table, parseTable } from "./table.ts";

export type DocumentPart =
  | { kind: "heading"; level: number; text: string }
  | { kind: "item"; depth: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "table"; table: Table }
  | { kind: "codeblock"; language: string; code: string };

const FENCE_OPEN = /^\s*```(.*)$/;
const FENCE_CLOSE = /^\s*```\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const ITEM = /^(\s*)(?:[-*+]|\d+\.)\s+(.*)$/;

export function parseDocument(text: string): DocumentPart[] {
  const parts: DocumentPart[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let table: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) parts.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
    if (table.length > 0) {
      // Lines that only look like a table stay text.
      const parsed = parseTable(table.join("\n"));
      parts.push(parsed ? { kind: "table", table: parsed } : { kind: "paragraph", text: table.join("\n") });
    }
    table = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      for (index += 1; index < lines.length && !FENCE_CLOSE.test(lines[index]); index += 1) code.push(lines[index]);
      parts.push({ kind: "codeblock", language: fence[1].trim(), code: code.join("\n") });
      continue;
    }
    if (line.trim().startsWith("|")) {
      if (paragraph.length > 0) flush();
      table.push(line);
      continue;
    }
    if (table.length > 0) flush();
    if (line.trim() === "") {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    const item = ITEM.exec(line);
    if (heading) {
      flush();
      parts.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    } else if (item) {
      flush();
      // A tab or two spaces of indent is one level deeper.
      const depth = Math.floor(item[1].replaceAll("\t", "  ").length / 2);
      parts.push({ kind: "item", depth, text: item[2] });
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return parts;
}

// The inline markdown a block's text may carry, split into the pieces the
// page renders. Anything not recognised stays plain text.

import { type Table, splitTables } from "./table.ts";

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "image"; alt: string; src: string; width?: number; height?: number } // the size, when Logseq wrote one after the image
  | { kind: "page"; name: string }
  | { kind: "reference"; id: string };

export type Part =
  | { kind: "inline"; inlines: Inline[] }
  | { kind: "codeblock"; language: string; code: string }
  | { kind: "table"; table: Table };

export type Marker = "DONE" | "NOW" | "WAITING" | "LATER";

const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g;
const INLINE =
  /!\[([^\]\n]*)\]\(([^)\s]+)\)(\{:[^}\n]*\})?|`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[\[([^\]\n]+)\]\]|\(\(([^()\s]+)\)\)|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)]+)|(?<![*\w])\*([^*\n]+)\*(?![*\w])/g;
const MARKER = /^(DONE|NOW|WAITING|LATER) /;

// A block's text in order: runs of inline text, fenced code blocks, and
// tables.
export function parseText(text: string): Part[] {
  const parts: Part[] = [];
  const inline = (run: string) => {
    for (const piece of splitTables(run)) {
      if (piece.kind === "table") parts.push(piece);
      else if (piece.text) parts.push({ kind: "inline", inlines: parseInline(piece.text) });
    }
  };
  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    inline(text.slice(last, match.index).replace(/\n$/, ""));
    parts.push({ kind: "codeblock", language: match[1].trim(), code: match[2].replace(/\n$/, "") });
    last = match.index + match[0].length;
  }
  inline(text.slice(last).replace(/^\n/, ""));
  return parts;
}

export function parseInline(text: string): Inline[] {
  const inlines: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) inlines.push({ kind: "text", text: text.slice(last, match.index) });
    const [, alt, src, size, code, bold, page, reference, linkText, linkHref, url, italic] = match;
    if (src !== undefined) inlines.push({ kind: "image", alt, src, ...imageSize(size) });
    else if (code !== undefined) inlines.push({ kind: "code", text: code });
    else if (bold !== undefined) inlines.push({ kind: "bold", text: bold });
    else if (page !== undefined) inlines.push({ kind: "page", name: page });
    else if (reference !== undefined) inlines.push({ kind: "reference", id: reference });
    else if (linkText !== undefined) inlines.push({ kind: "link", text: linkText, href: linkHref });
    else if (url !== undefined) inlines.push({ kind: "link", text: url, href: url });
    else inlines.push({ kind: "italic", text: italic });
    last = match.index + match[0].length;
  }
  if (last < text.length) inlines.push({ kind: "text", text: text.slice(last) });
  return inlines;
}

// The size Logseq writes after an image it resized, `{:height 300, :width
// 300}`, either number alone and in any order.
function imageSize(size: string | undefined): { width?: number; height?: number } {
  if (!size) return {};
  const width = /:width\s+(\d+)/.exec(size);
  const height = /:height\s+(\d+)/.exec(size);
  return { ...(width ? { width: Number(width[1]) } : {}), ...(height ? { height: Number(height[1]) } : {}) };
}

// A Logseq task marker at the start of a block, and the text after it.
export function splitMarker(text: string): { marker?: Marker; text: string } {
  const match = MARKER.exec(text);
  return match ? { marker: match[1] as Marker, text: text.slice(match[0].length) } : { text };
}

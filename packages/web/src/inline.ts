// The inline markdown a block's text may carry, split into the pieces the
// page renders. Anything not recognised stays plain text.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "page"; name: string }
  | { kind: "reference"; id: string };

export type Part = { kind: "inline"; inlines: Inline[] } | { kind: "codeblock"; language: string; code: string };

export type Marker = "DONE" | "NOW" | "LATER";

const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g;
const INLINE =
  /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[\[([^\]\n]+)\]\]|\(\(([^()\s]+)\)\)|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)]+)|(?<![*\w])\*([^*\n]+)\*(?![*\w])/g;
const MARKER = /^(DONE|NOW|LATER) /;

// A block's text in order: runs of inline text, and fenced code blocks.
export function parseText(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    const before = text.slice(last, match.index).replace(/\n$/, "");
    if (before) parts.push({ kind: "inline", inlines: parseInline(before) });
    parts.push({ kind: "codeblock", language: match[1].trim(), code: match[2].replace(/\n$/, "") });
    last = match.index + match[0].length;
  }
  const rest = text.slice(last).replace(/^\n/, "");
  if (rest) parts.push({ kind: "inline", inlines: parseInline(rest) });
  return parts;
}

export function parseInline(text: string): Inline[] {
  const inlines: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) inlines.push({ kind: "text", text: text.slice(last, match.index) });
    const [, code, bold, page, reference, linkText, linkHref, url, italic] = match;
    if (code !== undefined) inlines.push({ kind: "code", text: code });
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

// A Logseq task marker at the start of a block, and the text after it.
export function splitMarker(text: string): { marker?: Marker; text: string } {
  const match = MARKER.exec(text);
  return match ? { marker: match[1] as Marker, text: text.slice(match[0].length) } : { text };
}

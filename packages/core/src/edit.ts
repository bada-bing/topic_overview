// Changing one block of a Logseq file. A block is addressed by its `id::`,
// and only setId finds one without, by its line and its first line's text,
// both of which must match. A change splices the block's lines, so the rest
// of the file stays as it was, byte for byte. Content and properties are
// changed apart: replace changes a block's content and keeps its properties,
// setProperty changes one of its properties and keeps its content. These are
// a block's own `key:: value` lines, never the page's frontmatter.

import { numberByPlace } from "./logseq.ts";
import { type Block, parsePage, references, sourceProblems, walk } from "./page.ts";
import { StoreError } from "./store.ts";

export type Place = "after" | "before" | "into";

const BULLET = /^(\t*)- ?(.*)$/;
const PROPERTY = /^\s*([A-Za-z][\w-]*):: ?(.*)$/;

interface Span {
  start: number; // the block's first line
  own: number; // the line after its own lines: where its children start
  end: number; // the line after its last, children included
  depth: number;
  block: Block;
}

function body(lines: string[]): number {
  if (lines[0] !== "---") return 0;
  const end = lines.indexOf("---", 1);
  return end === -1 ? 0 : end + 1;
}

// Every block's lines, in the order the parser reads the blocks.
function spans(text: string): { lines: string[]; spans: Span[] } {
  const lines = text.split("\n");
  const limit = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  const starts: { line: number; depth: number }[] = [];
  for (let line = body(lines); line < limit; line += 1) {
    const bullet = BULLET.exec(lines[line]);
    if (bullet) starts.push({ line, depth: bullet[1].length });
  }
  const blocks = [...walk(parsePage(text).blocks)];
  if (blocks.length !== starts.length) throw new StoreError("the source could not be read as blocks");
  const result = starts.map((start, index) => {
    let end = limit;
    let own: number | undefined;
    for (const next of starts.slice(index + 1)) {
      if (next.depth <= start.depth) {
        end = next.line;
        break;
      }
      own ??= next.line;
    }
    if (own === undefined) {
      own = end;
      while (own > start.line + 1 && lines[own - 1].trim() === "") own -= 1;
    }
    return { start: start.line, own, end, depth: start.depth, block: blocks[index] };
  });
  return { lines, spans: result };
}

function byId(all: Span[], id: string): Span {
  const span = all.find((candidate) => candidate.block.id === id);
  if (!span) throw new StoreError(`no block has the id ${id}`);
  return span;
}

// The block whose first line is at the line, counted from 1 as an editor
// shows it, and reads as the text given. Either alone may have gone stale, so
// both must match.
function byLine(text: string, line: number, first: string): Span {
  const { lines, spans: all } = spans(text);
  const span = all.find((candidate) => candidate.start === line - 1);
  if (!span) throw new StoreError(`no block starts at line ${line}`);
  const written = BULLET.exec(lines[span.start])![2];
  if (written.trim() !== first.trim()) throw new StoreError(`the block at line ${line} reads "${written}", not "${first}"`);
  return span;
}

// A block named for a commit message: the start of its first line.
export function blockName(text: string, id: string): string {
  const first = byId(spans(text).spans, id).block.text.split("\n")[0];
  return first.length > 40 ? `"${first.slice(0, 39)}…"` : `"${first}"`;
}

// The block the view knows by an id: its own id, or the number the view gives
// a block without one by its place in the tree. The view never knows lines.
function byView(text: string, view: string): { lines: string[]; span: Span } {
  const { lines, spans: all } = spans(text);
  const page = parsePage(text);
  numberByPlace(page.blocks);
  const index = [...walk(page.blocks)].findIndex((block) => block.id === view);
  if (index === -1) throw new StoreError(`there is no block ${view} on the page`);
  return { lines, span: all[index] };
}

// Where the block the view knows sits in the file, for set-id, and its id if
// it has one.
export function locate(text: string, view: string): { line: number; first: string; id?: string } {
  const { lines, span } = byView(text, view);
  return { line: span.start + 1, first: BULLET.exec(lines[span.start])![2], id: span.block.id || undefined };
}

// A block's own text, as written after its bullet: its first line and the
// lines that continue it, without its properties and its children.
export function ownText(text: string, view: string): string {
  const { lines, span } = byView(text, view);
  const continued = lines
    .slice(span.start + 1, span.own)
    .filter((line) => !PROPERTY.test(line))
    .map((line) => line.replace(new RegExp(`^\\t{0,${span.depth}} {0,2}`), ""));
  return [BULLET.exec(lines[span.start])![2], ...continued].join("\n");
}

// A block for replace, made of new own text and the block's children as they
// are, so editing a block's text leaves what is under it alone.
export function withOwnText(text: string, id: string, own: string): string {
  const { lines, spans: all } = spans(text);
  const span = byId(all, id);
  const [first, ...rest] = own.replace(/\n+$/, "").split("\n");
  const children = dedent(lines.slice(span.own, span.end), span.depth);
  return [`- ${first}`, ...rest.map((line) => (line === "" ? line : `  ${line}`)), ...children].join("\n");
}

// One of a block's own properties, as it is now, if it has it.
export function propertyOf(text: string, id: string, name: string): string | undefined {
  const { lines, spans: all } = spans(text);
  const span = byId(all, id);
  for (const line of lines.slice(span.start + 1, span.own)) {
    const property = PROPERTY.exec(line);
    if (property?.[1] === name) return property[2];
  }
  return undefined;
}

// The headings a block sits under, as a path, such as Context / Links.
export function headingsAbove(text: string, id: string): string {
  const find = (blocks: Block[], path: string[]): string[] | undefined => {
    for (const block of blocks) {
      if (block.id === id) return path;
      const below = find(block.children, block.kind === "heading" ? [...path, block.text] : path);
      if (below) return below;
    }
    return undefined;
  };
  return (find(parsePage(text).blocks, []) ?? []).join(" / ");
}

// Where a block stood, said by what is around it once it is deleted: the
// block that follows in its place, or else its parent, whose children it
// ended. Both as the view knows them, by id or by place.
export function placeOfDeleted(text: string, id: string): { next?: string; parent?: string } {
  const find = (blocks: Block[], parent?: Block): { index: number; parent?: Block } | undefined => {
    const index = blocks.findIndex((block) => block.id === id);
    if (index !== -1) return { index, parent };
    for (const block of blocks) {
      const found = find(block.children, block);
      if (found) return found;
    }
    return undefined;
  };
  const before = parsePage(text);
  numberByPlace(before.blocks);
  const found = find(before.blocks);
  if (!found) throw new StoreError(`no block has the id ${id}`);
  const after = parsePage(deleteBlock(text, id));
  numberByPlace(after.blocks);
  // Deleting a child changes neither its parent's id nor its parent's place.
  const parentAfter = found.parent ? [...walk(after.blocks)].find((block) => block.id === found.parent!.id) : undefined;
  const siblings = found.parent ? (parentAfter?.children ?? []) : after.blocks;
  return { next: siblings[found.index]?.id, parent: found.parent?.id };
}

// The id of the block at the line, if it has one.
export function idAt(text: string, line: number, first: string): string | undefined {
  return byLine(text, line, first).block.id || undefined;
}

// Gives the block at the line the id, as Logseq writes one: a property among
// its own lines.
export function setId(text: string, line: number, first: string, id: string): string {
  const span = byLine(text, line, first);
  if (span.block.id) throw new StoreError(`the block at line ${line} has the id ${span.block.id}`);
  const lines = text.split("\n");
  lines.splice(span.own, 0, `${"\t".repeat(span.depth)}  id:: ${id}`);
  return lines.join("\n");
}

// A block given to be written: one bullet at depth 0, with its own lines
// and the children indented under it.
function given(input: string): string[] {
  const lines = input.replace(/\n+$/, "").split("\n");
  if (!lines[0]?.startsWith("- ")) throw new StoreError("a block starts with '- ' at depth 0");
  if (lines.slice(1).some((line) => line.startsWith("- "))) throw new StoreError("give one block; its children are indented under it");
  return lines;
}

// Where a block's own lines end in lines given at depth 0.
function ownEnd(lines: string[]): number {
  const child = lines.findIndex((line, index) => index > 0 && line.startsWith("\t- "));
  return child === -1 ? lines.length : child;
}

// Content given without properties: those are changed with setProperty.
function content(input: string): string[] {
  const lines = given(input);
  const own = lines.slice(1, ownEnd(lines));
  if (own.some((line) => PROPERTY.test(line))) throw new StoreError("give content only; a property is changed with set-property");
  return lines;
}

function indent(lines: string[], depth: number): string[] {
  return lines.map((line) => (line === "" ? line : "\t".repeat(depth) + line));
}

function dedent(lines: string[], depth: number): string[] {
  return lines.map((line) => line.slice(Math.min(depth, /^\t*/.exec(line)![0].length)));
}

// Where a block goes, as a line and a depth: after or before a block, or
// into it as its last child.
function placeAt(target: Span, place: Place): { line: number; depth: number } {
  if (place === "before") return { line: target.start, depth: target.depth };
  if (place === "after") return { line: target.end, depth: target.depth };
  return { line: target.end, depth: target.depth + 1 };
}

// A change is refused when it leaves a reference pointing at no block that
// it did not point at before, such as by deleting a block others refer to.
// A reference to a block that was not on the page before the change may be
// to a block on another page, which the view finds; the check does not look
// for it there, so a change stays as quick as the page is short.
function checked(before: string, after: string): string {
  const was = new Set([...walk(parsePage(before).blocks)].map((block) => block.id));
  const targets = [before, after].flatMap((text) => [...walk(parsePage(text).blocks)].flatMap((block) => references(block.text)));
  const elsewhere = new Set(targets.filter((target) => !was.has(target)));
  const broken = (text: string) => new Set(sourceProblems(parsePage(text), elsewhere).map((problem) => problem.reason));
  const known = broken(before);
  const added = [...broken(after)].filter((reason) => !known.has(reason));
  if (added.length > 0) throw new StoreError(`the change would leave a reference broken: ${added.join("; ")}`);
  return after;
}

// The block's content replaced, its children included; its own properties
// are kept as they were, after the new content's own lines.
export function replaceBlock(text: string, id: string, input: string): string {
  const { lines, spans: all } = spans(text);
  const span = byId(all, id);
  const properties = dedent(lines.slice(span.start + 1, span.own), span.depth).filter((line) => PROPERTY.test(line));
  const next = content(input);
  next.splice(ownEnd(next), 0, ...properties);
  lines.splice(span.start, span.end - span.start, ...indent(next, span.depth));
  return checked(text, lines.join("\n"));
}

// One of the block's own properties set to a value, added when it has none,
// or removed when the value is undefined. The id is the tool's, not set here.
export function setProperty(text: string, id: string, name: string, value: string | undefined): string {
  if (name === "id") throw new StoreError("the id is the tool's; give a block one with set-id");
  if (!/^[A-Za-z][\w-]*$/.test(name)) throw new StoreError(`${name} is not a property name`);
  const { lines, spans: all } = spans(text);
  const span = byId(all, id);
  const line = `${"\t".repeat(span.depth)}  ${name}:: ${value}`;
  for (let index = span.start + 1; index < span.own; index += 1) {
    if (PROPERTY.exec(lines[index])?.[1] !== name) continue;
    if (value === undefined) lines.splice(index, 1);
    else lines[index] = line;
    return lines.join("\n");
  }
  if (value === undefined) throw new StoreError(`the block has no ${name}`);
  lines.splice(span.own, 0, line);
  return lines.join("\n");
}

// The block's id line removed, as the tool removes the ids it gave when the
// discussion closes. A block that is gone, or has no such id, leaves the text
// as it was.
export function removeId(text: string, id: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => {
    const property = PROPERTY.exec(line);
    return property?.[1] === "id" && property[2].trim() === id;
  });
  if (at !== -1) lines.splice(at, 1);
  return lines.join("\n");
}

// A new block, given with its id, placed after or before a block, or into it
// as its last child.
export function insertBlock(text: string, place: Place, target: string, input: string, id: string): string {
  const { lines, spans: all } = spans(text);
  const at = placeAt(byId(all, target), place);
  const next = content(input);
  next.splice(ownEnd(next), 0, `  id:: ${id}`);
  lines.splice(at.line, 0, ...indent(next, at.depth));
  return checked(text, lines.join("\n"));
}

export function deleteBlock(text: string, id: string): string {
  const { lines, spans: all } = spans(text);
  const span = byId(all, id);
  lines.splice(span.start, span.end - span.start);
  return checked(text, lines.join("\n"));
}

// A move takes the block's own lines, so nothing of it is retyped.
export function moveBlock(text: string, id: string, place: Place, target: string): string {
  const { lines, spans: all } = spans(text);
  const span = byId(all, id);
  const goal = byId(all, target);
  if (goal.start >= span.start && goal.start < span.end) throw new StoreError("a block is not moved into itself");
  const moved = dedent(lines.slice(span.start, span.end), span.depth);
  lines.splice(span.start, span.end - span.start);
  const after = spans(lines.join("\n"));
  const at = placeAt(byId(after.spans, target), place);
  after.lines.splice(at.line, 0, ...indent(moved, at.depth));
  return checked(text, after.lines.join("\n"));
}

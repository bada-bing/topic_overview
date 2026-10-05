// page.md: the content of a discussion, as a nested markdown list in Logseq's
// conventions. A block is a bullet; its id is an `id::` property on the line
// after it, and a relation to another block is written `((id))`.

export type BlockKind = "heading" | "block";

export interface Block {
  id: string;
  kind: BlockKind;
  level?: number; // heading level, 1 to 6
  text: string;
  properties: Record<string, string>;
  children: Block[];
}

export interface Page {
  frontmatter: string; // as copied from the source, without the `---` fences
  blocks: Block[];
}

const BULLET = /^(\t*)- ?(.*)$/;
const PROPERTY = /^\s*([A-Za-z][\w-]*):: ?(.*)$/;
const HEADING = /^(#{1,6}) (.*)$/;
const REFERENCE = /\(\(([^()\s]+)\)\)/g;

export function parsePage(source: string): Page {
  let frontmatter = "";
  let body = source;
  if (source.startsWith("---\n")) {
    const end = source.indexOf("\n---\n", 4);
    if (end !== -1) {
      frontmatter = source.slice(4, end);
      body = source.slice(end + 5);
    }
  }

  const roots: Block[] = [];
  const stack: { depth: number; block: Block }[] = [];
  let current: Block | undefined;

  for (const line of body.split("\n")) {
    const bullet = BULLET.exec(line);
    if (bullet) {
      const depth = bullet[1].length;
      current = toBlock(bullet[2]);
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
      const parent = stack[stack.length - 1];
      (parent ? parent.block.children : roots).push(current);
      stack.push({ depth, block: current });
      continue;
    }
    if (!current || line.trim() === "") continue;
    const property = PROPERTY.exec(line);
    if (property) {
      if (property[1] === "id") current.id = property[2].trim();
      else current.properties[property[1]] = property[2];
    } else {
      current.text += "\n" + line.trim();
    }
  }

  return { frontmatter, blocks: roots };
}

function toBlock(content: string): Block {
  const heading = HEADING.exec(content);
  if (heading) {
    return { id: "", kind: "heading", level: heading[1].length, text: heading[2], properties: {}, children: [] };
  }
  return { id: "", kind: "block", text: content, properties: {}, children: [] };
}

export function* walk(blocks: Block[]): Generator<Block> {
  for (const block of blocks) {
    yield block;
    yield* walk(block.children);
  }
}

export function references(text: string): string[] {
  return [...text.matchAll(REFERENCE)].map((match) => match[1]);
}

// A page is valid when every block has an id, no id repeats, and every
// reference names a block on the page. Each problem is reported, not only
// the first, so a malformed page is refused with all of its reasons.
export function validatePage(page: Page): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const all = [...walk(page.blocks)];

  for (const block of all) {
    if (!block.id) problems.push(`a block has no id: "${excerpt(block.text)}"`);
    else if (ids.has(block.id)) problems.push(`the id ${block.id} is used more than once`);
    else ids.add(block.id);
  }
  for (const block of all) {
    for (const target of references(block.text)) {
      if (!ids.has(target)) problems.push(`block ${block.id || "without id"} references ${target}, which is not on the page`);
    }
  }
  return problems;
}

function excerpt(text: string): string {
  const line = text.split("\n")[0];
  return line.length > 60 ? line.slice(0, 57) + "..." : line;
}

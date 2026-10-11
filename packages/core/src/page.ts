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
      // A continuation line is indented by its block's tabs and two spaces;
      // anything beyond that is the text's own, as in a code block.
      const depth = stack[stack.length - 1].depth;
      current.text += "\n" + line.replace(new RegExp(`^\\t{0,${depth}} {0,2}`), "");
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

// A reference written inside code, such as `((b7))` in a sentence about the
// syntax, is text and not a relation.
export function references(text: string): string[] {
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return [...prose.matchAll(REFERENCE)].map((match) => match[1]);
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

// What a page cannot render: a reference to a block that is not on it. Each
// names the block holding the reference, so the page can lead to it.
export interface SourceProblem {
  block: string;
  excerpt: string;
  reason: string;
}

export function sourceProblems(page: Page): SourceProblem[] {
  const all = [...walk(page.blocks)];
  const ids = new Set(all.map((block) => block.id));
  const problems: SourceProblem[] = [];
  for (const block of all) {
    for (const target of references(block.text)) {
      if (!ids.has(target)) {
        problems.push({ block: block.id, excerpt: excerpt(block.text), reason: `references ((${target})), which is not on the page` });
      }
    }
  }
  return problems;
}

export function excerpt(text: string): string {
  const line = text.split("\n")[0];
  return line.length > 60 ? line.slice(0, 57) + "..." : line;
}

// Writes a page back in the same conventions it is read in, with every
// block's id as its first property.
export function serializePage(page: Page): string {
  const lines: string[] = [];
  if (page.frontmatter) lines.push("---", page.frontmatter, "---");
  const write = (blocks: Block[], depth: number) => {
    const indent = "\t".repeat(depth);
    for (const block of blocks) {
      const [first, ...rest] = block.text.split("\n");
      const head = block.kind === "heading" ? `${"#".repeat(block.level ?? 1)} ${first}` : first;
      lines.push(`${indent}- ${head}`.trimEnd());
      for (const line of rest) lines.push(`${indent}  ${line}`);
      lines.push(`${indent}  id:: ${block.id}`);
      for (const [key, value] of Object.entries(block.properties)) lines.push(`${indent}  ${key}:: ${value}`);
      write(block.children, depth + 1);
    }
  };
  write(page.blocks, 0);
  return lines.join("\n") + "\n";
}

// A label names a numbered line: capitals and a number followed by a colon
// at the start of a block, such as `R2:` or `REQ7:`. A mention of the label
// elsewhere, such as `(R2)`, relates to that block.
export const LABEL = /^([A-Z]{1,4}\d+):/;
export const MENTION = /\b([A-Z]{1,4}\d+)\b/g;

export function labels(page: Page): Map<string, string> {
  const found = new Map<string, string>();
  for (const block of walk(page.blocks)) {
    const label = LABEL.exec(block.text);
    if (label && !found.has(label[1])) found.set(label[1], block.id);
  }
  return found;
}

// Every block's relations: the blocks it references, by `((id))` or by
// mentioning a label. Code is text, so nothing inside it relates.
export function relations(page: Page): Map<string, Set<string>> {
  const byLabel = labels(page);
  const related = new Map<string, Set<string>>();
  for (const block of walk(page.blocks)) {
    const targets = new Set(references(block.text));
    const prose = block.text.replace(LABEL, "").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    for (const mention of prose.matchAll(MENTION)) {
      const target = byLabel.get(mention[1]);
      if (target) targets.add(target);
    }
    targets.delete(block.id);
    if (targets.size > 0) related.set(block.id, targets);
  }
  return related;
}

// The pages a page links to with [[name]]. A link written inside code is
// text, and links to nothing.
export function pageLinks(page: Page): Set<string> {
  const links = new Set<string>();
  for (const block of walk(page.blocks)) {
    const prose = block.text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    for (const match of prose.matchAll(/\[\[([^\]\n]+)\]\]/g)) links.add(match[1]);
  }
  return links;
}

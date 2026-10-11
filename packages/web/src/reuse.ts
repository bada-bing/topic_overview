import type { Block } from "@topic-overview/core";

// New content with every block that did not change replaced by the block it
// was before, the same object, so the page keeps it as it is drawn and redraws
// only what changed. A block is the same when its id, its content and its
// children are.
export function reuse(before: Block[], after: Block[]): Block[] {
  const known = new Map<string, Block>();
  const index = (blocks: Block[]) => {
    for (const block of blocks) {
      known.set(block.id, block);
      index(block.children);
    }
  };
  index(before);
  const keep = (block: Block): Block => {
    const children = block.children.map(keep);
    const old = known.get(block.id);
    const same =
      old !== undefined &&
      old.kind === block.kind &&
      old.level === block.level &&
      old.text === block.text &&
      JSON.stringify(old.properties) === JSON.stringify(block.properties) &&
      old.children.length === children.length &&
      old.children.every((child, position) => child === children[position]);
    return same ? old : { ...block, children };
  };
  return after.map(keep);
}

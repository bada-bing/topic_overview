import { For, Show } from "solid-js";

import type { Block } from "@topic-overview/core";
import { BlockFrame } from "./BlockFrame.tsx";
import { useFold } from "../fold.ts";
import { Heading } from "./Heading.tsx";
import { Paragraph } from "./Paragraph.tsx";

// The catalog's dispatch: each block kind is rendered by its own component,
// and a block's children are nested under it, unless the outline has folded
// them away.
export function Blocks(props: { blocks: Block[] }) {
  const fold = useFold();
  // Only a heading folds inside a section; any other block shows what is
  // under it whenever it shows itself.
  const folds = (block: Block) => block.kind === "heading" && block.children.length > 0;
  const unfolded = (block: Block) => !folds(block) || (fold.unfolded()?.has(block.id) ?? true);
  const toggle = (block: Block) =>
    fold.toggle && folds(block) ? { open: unfolded(block), onToggle: () => fold.toggle!(block.id) } : undefined;
  return (
    <ul class="blocks">
      <For each={props.blocks}>
        {(block) => (
          <li>
            <BlockFrame id={block.id} text={block.text}>
              <Show when={block.kind === "heading"} fallback={<Paragraph block={block} />}>
                <Heading block={block} fold={toggle(block)} />
              </Show>
            </BlockFrame>
            <Show when={block.children.length > 0 && unfolded(block)}>
              <Blocks blocks={block.children} />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

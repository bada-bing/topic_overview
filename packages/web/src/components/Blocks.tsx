import { For, Show } from "solid-js";

import type { Block } from "@topic-overview/core";
import { BlockFrame } from "./BlockFrame.tsx";
import { useFold } from "../fold.ts";
import { useMarks } from "../marks.ts";
import { RemovedLine } from "./RemovedLine.tsx";
import { Heading } from "./Heading.tsx";
import { Paragraph } from "./Paragraph.tsx";

// The catalog's dispatch: each block kind is rendered by its own component,
// and a block's children are nested under it, unless the outline has folded
// them away. Blocks are kept by their id, so new content updates a row in
// place, and a block that did not change is left as it is drawn.
export function Blocks(props: { blocks: Block[]; parent?: string }) {
  const fold = useFold();
  const marks = useMarks();
  // Only a heading folds inside a section; any other block shows what is
  // under it whenever it shows itself.
  const folds = (block: Block) => block.kind === "heading" && block.children.length > 0;
  const unfolded = (block: Block) => !folds(block) || (fold.unfolded()?.has(block.id) ?? true);
  const toggle = (block: Block) =>
    fold.toggle && folds(block) ? { open: unfolded(block), onToggle: () => fold.toggle!(block.id) } : undefined;
  return (
    <ul class="blocks">
      <For each={props.blocks} keyed={(block) => block.id}>
        {(block) => (
          <li>
            <For each={marks.removedBefore(block().id)}>{(mark) => <RemovedLine mark={mark} />}</For>
            <BlockFrame id={block().id} text={block().text}>
              <Show when={block().kind === "heading"} fallback={<Paragraph block={block()} />}>
                <Heading block={block()} fold={toggle(block())} />
              </Show>
            </BlockFrame>
            <Show when={block().children.length > 0 && unfolded(block())}>
              <Blocks blocks={block().children} parent={block().id} />
            </Show>
          </li>
        )}
      </For>
      <Show when={props.parent}>
        {(parent) => <For each={marks.removedAtEnd(parent())}>{(mark) => <li><RemovedLine mark={mark} /></li>}</For>}
      </Show>
    </ul>
  );
}

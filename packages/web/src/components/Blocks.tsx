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
  const unfolded = (id: string) => fold()?.has(id) ?? true;
  return (
    <ul class="blocks">
      <For each={props.blocks}>
        {(block) => (
          <li>
            <BlockFrame id={block.id} text={block.text}>
              <Show when={block.kind === "heading"} fallback={<Paragraph block={block} />}>
                <Heading block={block} />
              </Show>
            </BlockFrame>
            <Show when={block.children.length > 0 && unfolded(block.id)}>
              <Blocks blocks={block.children} />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

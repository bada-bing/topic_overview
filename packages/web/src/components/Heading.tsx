import { dynamic } from "@solidjs/web";
import { Show } from "solid-js";

import type { Block } from "@topic-overview/core";

import { useBlockIdentity } from "../column.ts";
import { useRelate } from "../relate.ts";
import { Text } from "./Text.tsx";

// A heading block, h1 to h6 by its level. One that folds shows whether it
// is open, and clicking it, anywhere but on a link, folds or unfolds it.
export function Heading(props: { block: Block; fold?: { open: boolean; onToggle: () => void } }) {
  const Tag = dynamic(() => `h${Math.min(props.block.level ?? 1, 6)}`);
  const relate = useRelate();
  const identity = useBlockIdentity();
  return (
    <Tag
      id={identity.elementId(props.block.id)}
      data-block={identity.key(props.block.id)}
      class={["heading", { foldable: !!props.fold, tinted: relate.tinted().has(identity.key(props.block.id)), pointed: relate.pointed() === identity.key(props.block.id) }]}
      onClick={(event: MouseEvent) => {
        if (!props.fold || (event.target as Element).closest("a, [role=link]")) return;
        props.fold.onToggle();
      }}
    >
      <Show when={props.fold}>{(fold) => <span class="fold">{fold().open ? "▾" : "▸"}</span>}</Show>
      <Text text={props.block.text} />
    </Tag>
  );
}

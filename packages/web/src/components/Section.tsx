import { Show } from "solid-js";

import type { Block } from "@topic-overview/core";

import { FoldContext } from "../fold.ts";
import { Blocks } from "./Blocks.tsx";
import { Text } from "./Text.tsx";

// A top-level block with children. Its heading opens and closes it; while it
// is closed only the heading shows. While one heading inside it is chosen,
// `unfolded` says which of its blocks show their children.
export function Section(props: { block: Block; open: boolean; unfolded?: Set<string>; onToggle: () => void }) {
  return (
    <section class={["section", { open: props.open }]}>
      <h2 id={props.block.id} class="section-heading">
        <button type="button" class="section-toggle" aria-expanded={props.open ? "true" : "false"} onClick={() => props.onToggle()}>
          <span class="fold">{props.open ? "▾" : "▸"}</span>
          <Text text={props.block.text} />
        </button>
      </h2>
      <Show when={props.open}>
        <FoldContext value={() => props.unfolded}>
          <Blocks blocks={props.block.children} />
        </FoldContext>
      </Show>
    </section>
  );
}

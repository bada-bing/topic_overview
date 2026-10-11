import { Show } from "solid-js";

import type { Block } from "@topic-overview/core";

import { FoldContext } from "../fold.ts";
import { Blocks } from "./Blocks.tsx";
import { Text } from "./Text.tsx";

// A top-level block with children. Its heading opens and closes it; while it
// is closed only the heading shows. The headings inside it fold the same way,
// through the same toggle.
export function Section(props: { block: Block; unfolded: Set<string>; onToggle: (id: string) => void }) {
  const open = () => props.unfolded.has(props.block.id);
  return (
    <section class={["section", { open: open() }]}>
      <h2 id={props.block.id} class="section-heading">
        <button type="button" class="section-toggle" aria-expanded={open() ? "true" : "false"} onClick={() => props.onToggle(props.block.id)}>
          <span class="fold">{open() ? "▾" : "▸"}</span>
          <Text text={props.block.text} />
        </button>
      </h2>
      <Show when={open()}>
        <FoldContext value={{ unfolded: () => props.unfolded, toggle: props.onToggle }}>
          <Blocks blocks={props.block.children} />
        </FoldContext>
      </Show>
    </section>
  );
}

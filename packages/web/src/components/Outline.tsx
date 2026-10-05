import { For } from "solid-js";

import type { OutlineEntry } from "../outline.ts";
import { Text } from "./Text.tsx";

// The page's sections and the headings inside them. Choosing an entry jumps
// to its block, which opens its section.
export function Outline(props: { entries: OutlineEntry[]; open: string | undefined }) {
  return (
    <nav class="outline">
      <For each={props.entries}>
        {(entry) => (
          <a
            href={`#${entry.id}`}
            class={["outline-entry", `depth-${Math.min(entry.depth, 3)}`, { current: entry.depth === 0 && entry.id === props.open }]}
          >
            <Text text={entry.text} />
          </a>
        )}
      </For>
    </nav>
  );
}

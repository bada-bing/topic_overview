import { For } from "solid-js";

import type { OutlineEntry } from "../outline.ts";
import { Text } from "./Text.tsx";

// The page's sections and the headings inside them. Choosing an entry jumps
// to its block, which opens its section; the button that shows when I point
// at an entry opens it in the column beside.
export function Outline(props: {
  entries: OutlineEntry[];
  open: string | undefined;
  beside: string | undefined;
  onBeside: (id: string) => void;
}) {
  return (
    <nav class="outline">
      <For each={props.entries}>
        {(entry) => (
          <div
            class={[
              "outline-entry",
              `depth-${Math.min(entry.depth, 3)}`,
              { current: entry.depth === 0 && entry.id === props.open, beside: entry.id === props.beside },
            ]}
          >
            <a href={`#${entry.id}`}>
              <Text text={entry.text} />
            </a>
            <button type="button" class="open-beside" title="Open in the column beside" onClick={() => props.onBeside(entry.id)}>
              ⇥
            </button>
          </div>
        )}
      </For>
    </nav>
  );
}

import { For } from "solid-js";

import type { OutlineEntry } from "../outline.ts";
import { Text } from "./Text.tsx";

// The page's sections and the headings inside them. Choosing an entry opens
// it alone, and choosing it again folds it; the button that shows when I
// point at an entry opens it in the column beside.
export function Outline(props: {
  entries: OutlineEntry[];
  chosen: string | undefined;
  beside: string | undefined;
  onChoose: (id: string) => void;
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
              { current: entry.id === props.chosen, beside: entry.id === props.beside },
            ]}
          >
            <a
              href={`#${entry.id}`}
              onClick={(event) => {
                event.preventDefault();
                props.onChoose(entry.id);
              }}
            >
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

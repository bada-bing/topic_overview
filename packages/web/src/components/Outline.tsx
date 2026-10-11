import { For } from "solid-js";

import type { OutlineEntry } from "../outline.ts";
import { Text } from "./Text.tsx";

// The page's sections and the headings inside them, the one open marked.
// Choosing an entry folds or unfolds it, as clicking its heading on the page
// does; the button that
// shows when I point at an entry opens it in the column beside.
export function Outline(props: {
  entries: OutlineEntry[];
  current: string | undefined;
  beside: string | undefined;
  onToggle: (id: string) => void;
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
              { current: entry.id === props.current, beside: entry.id === props.beside },
            ]}
          >
            <a
              href={`#${entry.id}`}
              onClick={(event) => {
                event.preventDefault();
                props.onToggle(entry.id);
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

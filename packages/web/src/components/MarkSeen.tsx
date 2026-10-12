import { Show } from "solid-js";

import type { Mark } from "@topic-overview/core";

import { useMarks } from "../marks.ts";

import { Text } from "./Text.tsx";

const DONE: Record<Mark["kind"], string> = { changed: "changed", new: "added", moved: "moved", removed: "removed" };

// What the agent did to a block, as the list and the check's hover say it.
export function saidOf(mark: Mark): string {
  return `${DONE[mark.kind]} by the agent`;
}

// The check that confirms I saw a change, beside its block or in the list of
// changes. Hovering it shows what the block read before, or where it was
// before a move; an added block has nothing before. While the agent works,
// it is disabled.
export function MarkSeen(props: { mark: Mark; onSeen: () => void; inline?: boolean }) {
  const marks = useMarks();
  return (
    <span class={["mark-seen-wrap", "has-preview", { inline: !!props.inline }]}>
      <button
        type="button"
        class={["mark-seen", `mark-${props.mark.kind}`]}
        title={marks.blocked()}
        disabled={marks.blocked() !== undefined}
        onClick={() => props.onSeen()}
      >
        ✓
      </button>
      <span class="preview mark-before">
        <strong>This block was {saidOf(props.mark)}; the check confirms you saw it.</strong>
        <Show
          when={props.mark.kind === "removed" ? props.mark.text : props.mark.before}
          fallback={<span class="mark-before-none">Nothing before: it is new.</span>}
        >
          {(before) => (
            <>
              <span class="mark-before-label">{props.mark.kind === "removed" ? "It read:" : "Before:"}</span>
              <span class="mark-before-text">
                <Text text={before()} />
              </span>
            </>
          )}
        </Show>
      </span>
    </span>
  );
}

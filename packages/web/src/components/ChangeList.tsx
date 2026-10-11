import { For, Show } from "solid-js";

import type { Mark } from "@topic-overview/core";

const EXCERPT = 60;

const KINDS: Record<Mark["kind"], string> = { changed: "changed", new: "added", moved: "moved" };

// The start of a block's text as it reads, without its markup: a link shows
// its text, a page link its name, code its content.
function excerpt(text: string): string {
  const line = text
    .split("\n")[0]
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1");
  return line.length > EXCERPT ? `${line.slice(0, EXCERPT)}…` : line;
}

// The blocks the agent changed that I have not confirmed seeing, so I know
// where to look. Choosing one opens the way to its block; the check confirms
// I saw it, as the one beside the block does.
export function ChangeList(props: { marks: Mark[]; blockText: (id: string) => string | undefined; onSeen: (id: string) => void }) {
  return (
    <Show when={props.marks.length > 0}>
      <section class="comment-list change-list">
        <h3>Changes ({props.marks.length})</h3>
        <For each={props.marks}>
          {(mark) => (
            <div class="change-list-entry">
              <a class="comment-list-entry" href={`#${mark.id}`}>
                <span class="comment-list-block">{KINDS[mark.kind]}</span>
                <span class="comment-list-body">{excerpt(props.blockText(mark.id) ?? "")}</span>
              </a>
              <button type="button" class="mark-seen" title="Confirm you saw it" onClick={() => props.onSeen(mark.id)}>
                ✓
              </button>
            </div>
          )}
        </For>
      </section>
    </Show>
  );
}

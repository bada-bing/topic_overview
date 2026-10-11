import { For, Show } from "solid-js";

import type { Block, Mark } from "@topic-overview/core";

import { MarkSeen, saidOf } from "./MarkSeen.tsx";

const EXCERPT = 60;

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

// The blocks the agent changed that I have not confirmed seeing, so I
// know where to look. Choosing one opens the way to its block; the check
// confirms I saw it, as the one beside the block does. A removed block is
// listed with what it read, struck through, and leads to where it stood: the
// block that took its place, or its parent.
export function ChangeList(props: { marks: Mark[]; blockOf: (mark: Mark) => Block | undefined; onSeen: (mark: Mark) => void }) {
  return (
    <Show when={props.marks.length > 0}>
      <section class="comment-list change-list">
        <h3>Changes ({props.marks.length})</h3>
        <For each={props.marks}>
          {(mark) => (
            <div class="change-list-entry">
              <Show
                when={mark.kind !== "removed"}
                fallback={
                  <Show
                    when={mark.next ?? mark.parent}
                    fallback={
                      <span class={["comment-list-entry", "change-removed"]}>
                        <span class="comment-list-block">{saidOf(mark)}</span>
                        <span class="comment-list-body change-gone">{excerpt(mark.text ?? "")}</span>
                      </span>
                    }
                  >
                    {(place) => (
                      <a class={["comment-list-entry", "change-removed"]} href={`#${place()}`}>
                        <span class="comment-list-block">{saidOf(mark)}</span>
                        <span class="comment-list-body change-gone">{excerpt(mark.text ?? "")}</span>
                      </a>
                    )}
                  </Show>
                }
              >
                <a class={["comment-list-entry", `change-${mark.kind}`]} href={`#${props.blockOf(mark)?.id ?? ""}`}>
                  <span class="comment-list-block">{saidOf(mark)}</span>
                  <span class="comment-list-body">{excerpt(props.blockOf(mark)?.text ?? mark.text ?? "")}</span>
                </a>
              </Show>
              <MarkSeen mark={mark} onSeen={() => props.onSeen(mark)} inline />
            </div>
          )}
        </For>
      </section>
    </Show>
  );
}

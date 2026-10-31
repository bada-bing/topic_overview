import { For, Show } from "solid-js";

import type { Block, Mark } from "@topic-overview/core";

import { useQuestions } from "../questions.ts";
import { MarkSeen, saidOf } from "./MarkSeen.tsx";
import { HELD_BY_QUESTION } from "./RemovedLine.tsx";

const EXCERPT = 60;

// The start of a block's text as it reads, without its markup: a link shows
// its text, a page link its name, code its content.
export function excerpt(text: string): string {
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
// block that took its place, or its parent, and is kept while a question
// about the block is.
export function ChangeList(props: { marks: Mark[]; blockOf: (mark: Mark) => Block | undefined; onSeen: (mark: Mark) => void }) {
  const questions = useQuestions();
  const held = (mark: Mark) => (mark.kind === "removed" && mark.id && questions.of(mark.id).length > 0 ? HELD_BY_QUESTION : undefined);
  return (
    <Show when={props.marks.length > 0}>
      <section class="list-box change-list">
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
                      <span class={["list-entry", "change-removed"]}>
                        <span class="list-entry-block">{saidOf(mark)}</span>
                        <span class="list-entry-body change-gone">{excerpt(mark.text ?? "")}</span>
                      </span>
                    }
                  >
                    {(place) => (
                      <a class={["list-entry", "change-removed"]} href={`#${place()}`}>
                        <span class="list-entry-block">{saidOf(mark)}</span>
                        <span class="list-entry-body change-gone">{excerpt(mark.text ?? "")}</span>
                      </a>
                    )}
                  </Show>
                }
              >
                <a class={["list-entry", `change-${mark.kind}`]} href={`#${props.blockOf(mark)?.id ?? ""}`}>
                  <span class="list-entry-block">{saidOf(mark)}</span>
                  <span class="list-entry-body">{excerpt(props.blockOf(mark)?.text ?? mark.text ?? "")}</span>
                </a>
              </Show>
              <MarkSeen mark={mark} onSeen={() => props.onSeen(mark)} inline held={held(mark)} />
            </div>
          )}
        </For>
      </section>
    </Show>
  );
}

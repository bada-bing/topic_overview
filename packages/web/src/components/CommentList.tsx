import { For, Show } from "solid-js";

import type { Annotation } from "@topic-overview/core";

const EXCERPT = 60;

function excerpt(text: string): string {
  const line = text.split("\n")[0];
  return line.length > EXCERPT ? `${line.slice(0, EXCERPT)}…` : line;
}

// Every comment on the page: the block it is on, the start of that block's
// text, and how the comment starts. Choosing one jumps to its block.
export function CommentList(props: { annotations: Annotation[]; blockText: (id: string) => string | undefined }) {
  return (
    <Show when={props.annotations.length > 0}>
      <section class="comment-list">
        <h3>Comments ({props.annotations.length})</h3>
        <For each={props.annotations}>
          {(annotation) => (
            <a class="comment-list-entry" href={`#${annotation.target}`}>
              <span class="comment-list-block">
                {annotation.target} · {excerpt(props.blockText(annotation.target) ?? "")}
              </span>
              <span class="comment-list-body">{excerpt(annotation.body)}</span>
            </a>
          )}
        </For>
      </section>
    </Show>
  );
}

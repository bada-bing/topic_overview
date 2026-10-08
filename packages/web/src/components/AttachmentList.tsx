import { For, Show } from "solid-js";

import type { Attachment } from "@topic-overview/core";

// The attachments of the discussion. Choosing one opens it in the column
// beside, next to the text it is about.
export function AttachmentList(props: { attachments: Attachment[]; open: string | undefined; onOpen: (id: string) => void }) {
  return (
    <Show when={props.attachments.length > 0}>
      <section class="attachment-list">
        <h3>Attachments ({props.attachments.length})</h3>
        <For each={props.attachments}>
          {(attachment) => (
            <button
              type="button"
              class={["attachment-list-entry", { current: attachment.id === props.open }]}
              onClick={() => props.onOpen(attachment.id)}
            >
              <span class="attachment-kind">{attachment.kind}</span>
              <span>{attachment.title}</span>
            </button>
          )}
        </For>
      </section>
    </Show>
  );
}

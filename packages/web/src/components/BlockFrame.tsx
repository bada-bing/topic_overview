import type { JSX } from "@solidjs/web";
import { For, Show, createSignal, useContext } from "solid-js";

import type { Annotation } from "@topic-overview/core";

import { SourcePageContext } from "../column.ts";
import { useComments } from "../comments.ts";

// Everything around a block's content: the gutter with its id and the
// Comment and Copy buttons, which show when I point at the block and never
// cover its text; the badge of its comments; and the field for a new one.
export function BlockFrame(props: { id: string; children: JSX.Element }) {
  const comments = useComments();
  const linkedPage = useContext(SourcePageContext);
  const [writing, setWriting] = createSignal(false);
  const [pinned, setPinned] = createSignal(false);
  let content: HTMLDivElement | undefined;
  const own = () => (linkedPage ? [] : comments.of(props.id));
  const canComment = () => !linkedPage && !comments.readOnly();

  return (
    <div class="block-frame">
      <div class="gutter">
        <span class="gutter-buttons">
          <Show when={canComment()}>
            <button type="button" title="Comment on this block" onClick={() => setWriting(true)}>
              💬
            </button>
          </Show>
          <button type="button" title="Copy the text of this block" onClick={() => copy(content?.innerText ?? "")}>
            ⧉
          </button>
        </span>
        <span class="gutter-id">{props.id}</span>
      </div>
      <div class="block-body" ref={(element) => (content = element)}>
        {props.children}
      </div>
      <Show when={own().length > 0}>
        <div class={["comment-badge", { pinned: pinned() }]}>
          <button type="button" class="badge" onClick={() => setPinned(!pinned())}>
            {own().length === 1 ? "1 comment" : `${own().length} comments`}
          </button>
          <div class="comment-popover">
            <For each={own()}>{(annotation) => <CommentItem annotation={annotation} pinned={pinned()} />}</For>
          </div>
        </div>
      </Show>
      <Show when={writing()}>
        <CommentField
          onSave={async (body) => {
            await comments.add(props.id, body);
            setWriting(false);
          }}
          onCancel={() => setWriting(false)}
        />
      </Show>
    </div>
  );
}

function CommentItem(props: { annotation: Annotation; pinned: boolean }) {
  const comments = useComments();
  const [editing, setEditing] = createSignal(false);
  return (
    <div class="comment">
      <Show
        when={editing()}
        fallback={
          <>
            <div class="comment-body">{props.annotation.body}</div>
            <Show when={props.pinned}>
              <div class="comment-actions">
                <button type="button" onClick={() => copy(props.annotation.body)}>
                  Copy
                </button>
                <Show when={!comments.readOnly()}>
                  <button type="button" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => comments.remove(props.annotation.id)}>
                    Delete
                  </button>
                </Show>
              </div>
            </Show>
          </>
        }
      >
        <CommentField
          initial={props.annotation.body}
          onSave={async (body) => {
            await comments.edit(props.annotation.id, body);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Show>
    </div>
  );
}

// A field for writing a comment. Ctrl or Cmd with Enter saves it, Escape
// cancels it.
function CommentField(props: { initial?: string; onSave: (body: string) => Promise<void>; onCancel: () => void }) {
  const [error, setError] = createSignal<string | undefined>(undefined);
  let field: HTMLTextAreaElement | undefined;
  const save = () => {
    const body = field?.value.trim() ?? "";
    if (!body) return;
    props.onSave(body).catch((failure: unknown) => setError(String(failure)));
  };
  return (
    <div class="comment-field">
      <textarea
        ref={(element) => {
          field = element;
          queueMicrotask(() => element.focus());
        }}
        rows={3}
        value={props.initial ?? ""}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
          if (event.key === "Escape") props.onCancel();
        }}
      />
      <div class="comment-field-actions">
        <button type="button" onClick={save}>
          Save
        </button>
        <button type="button" onClick={() => props.onCancel()}>
          Cancel
        </button>
        <Show when={error()}>
          <span class="error">{error()}</span>
        </Show>
      </div>
    </div>
  );
}

function copy(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

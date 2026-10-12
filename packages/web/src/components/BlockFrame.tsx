import type { JSX } from "@solidjs/web";
import { For, Show, createSignal, useContext } from "solid-js";

import type { Annotation } from "@topic-overview/core";
import { LABEL } from "@topic-overview/core/page";

import { SourcePageContext } from "../column.ts";
import { useComments } from "../comments.ts";
import { useEditing } from "../editing.ts";
import { useMarks } from "../marks.ts";
import { useQuestions } from "../questions.ts";
import { MarkSeen } from "./MarkSeen.tsx";
import { QuestionItem } from "./QuestionItem.tsx";
import { TextField } from "./TextField.tsx";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Everything around a block's content: the gutter with its name and the
// Edit, Ask, Comment and Copy buttons, which show when I point at the block and
// never cover its text; the badge of its comments; and the field for a new
// one. Editing puts the block's own text in a field in place of its content.
// A block the agent changed is marked, with a tint and a border, until I
// confirm I saw it with the check in its gutter, or open it to edit. The
// questions I asked about the block are under it until I dismiss them.
// A block is named by its label, such as R2, when it has one, and by its id
// otherwise.
export function BlockFrame(props: { id: string; text: string; children: JSX.Element }) {
  const comments = useComments();
  const linkedPage = useContext(SourcePageContext);
  const [writing, setWriting] = createSignal(false);
  const [pinned, setPinned] = createSignal(false);
  let content: HTMLDivElement | undefined;
  const own = () => (linkedPage ? [] : comments.of(props.id));
  const canComment = () => !linkedPage && !comments.readOnly();
  // A Logseq id is a UUID, too long for the gutter, so it shows its start;
  // the whole id is in the title.
  const name = () => LABEL.exec(props.text)?.[1] ?? (UUID.test(props.id) ? props.id.slice(0, 8) : props.id);
  const editing = useEditing();
  const marks = useMarks();
  const mark = () => (linkedPage ? undefined : marks.of(props.id));
  const canEdit = !linkedPage && editing.available;
  const questions = useQuestions();
  const canAsk = !linkedPage && questions.available;
  const asked = () => (linkedPage ? [] : questions.of(props.id));
  const [asking, setAsking] = createSignal(false);
  const [draft, setDraft] = createSignal<string | undefined>(undefined);
  const [loadError, setLoadError] = createSignal<string | undefined>(undefined);
  // Opening a block to edit it means I have seen what the agent changed in
  // it, so it confirms the change as the check does.
  const startEditing = () => {
    const shown = mark();
    if (shown) marks.clear(shown);
    setLoadError(undefined);
    editing.load(props.id).then(setDraft, (failure: unknown) => setLoadError(String(failure)));
  };

  return (
    <div class={["block-frame", { marked: !!mark() }, mark() ? `marked-${mark()!.kind}` : ""]}>
      <Show when={mark()}>{(shown) => <MarkSeen mark={shown()} onSeen={() => marks.clear(shown())} />}</Show>
      <div class="gutter">
        <span class="gutter-buttons">
          <Show when={canEdit}>
            <button
              type="button"
              title={editing.blocked() ?? "Edit this block"}
              disabled={editing.blocked() !== undefined}
              onClick={startEditing}
            >
              ✎
            </button>
          </Show>
          <Show when={canAsk}>
            <button
              type="button"
              title={questions.blocked() ?? "Ask the agent about this block"}
              disabled={questions.blocked() !== undefined}
              onClick={() => setAsking(true)}
            >
              ?
            </button>
          </Show>
          <Show when={canComment()}>
            <button type="button" title="Comment on this block" onClick={() => setWriting(true)}>
              💬
            </button>
          </Show>
          <button type="button" title="Copy the text of this block" onClick={() => copy(content?.innerText ?? "")}>
            ⧉
          </button>
        </span>
        <span class="gutter-id" title={props.id}>
          {name()}
        </span>
      </div>
      <Show
        when={draft()}
        fallback={
          <div class="block-body" ref={(element) => (content = element)}>
            {props.children}
            <Show when={loadError()}>
              <span class="error">{loadError()}</span>
            </Show>
          </div>
        }
      >
        {(text) => (
          <TextField
            initial={text()}
            onSave={async (body) => {
              await editing.save(props.id, body);
              setDraft(undefined);
            }}
            onCancel={() => setDraft(undefined)}
          />
        )}
      </Show>
      <For each={asked()} keyed={(question) => question.id}>{(question) => <QuestionItem question={question()} />}</For>
      <Show when={asking()}>
        <TextField
          action="Ask"
          onSave={async (prompt) => {
            await questions.ask(props.id, prompt);
            setAsking(false);
          }}
          onCancel={() => setAsking(false)}
        />
      </Show>
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
        <TextField
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
        <TextField
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

function copy(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

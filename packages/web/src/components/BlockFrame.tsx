import type { JSX } from "@solidjs/web";
import { For, Show, createSignal, useContext } from "solid-js";

import { LABEL } from "@topic-overview/core/page";

import { SourcePageContext } from "../column.ts";
import { useEditing } from "../editing.ts";
import { useMarks } from "../marks.ts";
import { useQuestions } from "../questions.ts";
import { MarkSeen } from "./MarkSeen.tsx";
import { QuestionItem } from "./QuestionItem.tsx";
import { TextField } from "./TextField.tsx";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Everything around a block's content: the gutter with its name and the
// Edit, Ask and Copy buttons, which show when I point at the block and never
// cover its text. Editing puts the block's own text in a field in place of
// its content.
// A block the agent changed is marked, with a tint and a border, until I
// confirm I saw it with the check in its gutter, or open it to edit. The
// questions I asked about the block are under it until I dismiss them.
// A block is named by its label, such as R2, when it has one, and by its id
// otherwise.
export function BlockFrame(props: { id: string; text: string; children: JSX.Element }) {
  const linkedPage = useContext(SourcePageContext);
  let content: HTMLDivElement | undefined;
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
            {/* Asking opens while either the agent or a fork of its session
                can be asked; the field says which. */}
            <button
              type="button"
              title={
                questions.blocked() === undefined
                  ? "Ask the agent about this block, or a fork of its session"
                  : questions.forkBlocked() === undefined
                    ? `${questions.blocked()}, or ask a fork of its session now`
                    : questions.blocked()
              }
              disabled={questions.blocked() !== undefined && questions.forkBlocked() !== undefined}
              onClick={() => setAsking(true)}
            >
              ?
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
      <For each={asked()} keyed={(question) => question.id}>{(question) => <QuestionItem question={question()} text={props.text} />}</For>
      <Show when={asking()}>
        <TextField
          action="Ask"
          blocked={questions.blocked()}
          onSave={async (prompt) => {
            await questions.ask(props.id, prompt);
            setAsking(false);
          }}
          secondary={{
            action: "Ask a fork",
            title: questions.forkBlocked() ?? "Ask a fork of the agent's session instead, which answers while the agent works",
            onSave: async (prompt) => {
              await questions.askFork(prompt, props.id);
              setAsking(false);
            },
          }}
          onCancel={() => setAsking(false)}
        />
      </Show>
    </div>
  );
}

function copy(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

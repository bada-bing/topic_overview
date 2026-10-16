import { For, Show, createEffect, createSignal, onSettled, untrack } from "solid-js";

import type { Question } from "@topic-overview/core/question";
import type { TranscriptEntry } from "@topic-overview/core/transcript";

import { parseDocument } from "../document.ts";
import { DocumentPiece } from "./AssetView.tsx";
import { QuestionItem } from "./QuestionItem.tsx";

// What the discussion's agent says and does, read from its session's
// transcript as it is written, and a field to ask something general, about
// the topic rather than one block. The terminal shows the same conversation; this panel
// is where I read it without leaving the page, and where a generic question
// is asked from. What I typed and what the agent replied are drawn in full,
// the reply as markdown; each tool it called is one line that unfolds to
// what it was given and what came back. The list follows the end while I
// am at it, and stays where I scrolled to otherwise.
//
// A question the field sends to a fork instead, which it can do while the
// main agent is busy, is its own exchange, drawn under the list with its follow-ups until
// I dismiss it; the main agent's transcript knows nothing of it.
export function TranscriptPanel(props: {
  entries: TranscriptEntry[];
  agent: string;
  forks: Question[];
  blocked: () => string | undefined;
  forkBlocked: () => string | undefined;
  onPrompt: (prompt: string) => Promise<void>;
  onFork: (prompt: string) => Promise<void>;
}) {
  let list: HTMLDivElement | undefined;
  let atEnd = true;
  const onScroll = () => {
    if (list) atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  };
  const toEnd = () => {
    if (list && atEnd) list.scrollTop = list.scrollHeight;
  };
  onSettled(toEnd);
  createEffect(
    () => props.entries.length + props.entries.filter((entry) => entry.kind === "tool" && entry.result !== undefined).length,
    () => queueMicrotask(toEnd),
  );
  return (
    <section class="transcript-panel">
      <div class="transcript-list" ref={(element) => (list = element)} onScroll={onScroll}>
        <Show when={props.entries.length === 0}>
          <p class="transcript-empty">
            {props.agent === "gone" ? "No Claude session runs in the discussion's window." : "Nothing in the transcript yet."}
          </p>
        </Show>
        <For each={props.entries} keyed={(entry) => entry.id}>
          {(entry) => <Entry entry={entry()} />}
        </For>
      </div>
      <Show when={props.forks.length > 0}>
        <div class="transcript-forks">
          <For each={props.forks} keyed={(question) => question.id}>
            {(question) => <QuestionItem question={question()} text="" />}
          </For>
        </div>
      </Show>
      <PromptField blocked={props.blocked} forkBlocked={props.forkBlocked} onPrompt={props.onPrompt} onFork={props.onFork} />
    </section>
  );
}

function Entry(props: { entry: TranscriptEntry }) {
  // An entry keeps its kind, so it is read once; what may change, a tool's
  // result, is read in the JSX.
  const kind = untrack(() => props.entry.kind);
  const time = () => {
    const at = new Date(props.entry.at);
    return Number.isNaN(at.getTime()) ? "" : at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  if (kind === "prompt") {
    return (
      <div class="transcript-entry transcript-prompt">
        <div class="transcript-head">
          <span class="transcript-role">You</span>
          <span class="transcript-time">{time()}</span>
        </div>
        <div class="transcript-prompt-text">{props.entry.kind === "prompt" ? props.entry.text : ""}</div>
      </div>
    );
  }
  if (kind === "reply") {
    const parts = untrack(() => (props.entry.kind === "reply" ? parseDocument(props.entry.text) : []));
    return (
      <div class="transcript-entry transcript-reply">
        <div class="transcript-head">
          <span class="transcript-role">Agent</span>
          <span class="transcript-time">{time()}</span>
        </div>
        <div class="transcript-reply-text">
          <For each={parts}>{(part) => <DocumentPiece part={part} />}</For>
        </div>
      </div>
    );
  }
  const tool = () => (props.entry.kind === "tool" ? props.entry : undefined);
  return (
    <Show when={tool()}>
      {(call) => (
        <details class={["transcript-entry", "transcript-tool", { failed: call().failed === true }]}>
          <summary>
            <span class="transcript-tool-name">{call().name}</span> {call().summary}
            <Show when={call().result === undefined}>
              <span class="transcript-tool-pending"> …</span>
            </Show>
            <Show when={call().failed}>
              <span class="transcript-tool-failed"> failed</span>
            </Show>
          </summary>
          <pre class="codeblock transcript-input">
            <code>{call().input}</code>
          </pre>
          <Show when={call().result}>
            {(result) => (
              <pre class="codeblock transcript-result">
                <code>{result()}</code>
              </pre>
            )}
          </Show>
        </details>
      )}
    </Show>
  );
}

// A general prompt, about the topic rather than one block, for the agent,
// typed into its window as it is, or for a fork of its session. Writing is
// always possible; sending to the agent waits until it is not working, as
// asking does, and the button says why it cannot be sent yet. A fork is
// asked at any time the agent's session is there, busy or not.
function PromptField(props: {
  blocked: () => string | undefined;
  forkBlocked: () => string | undefined;
  onPrompt: (prompt: string) => Promise<void>;
  onFork: (prompt: string) => Promise<void>;
}) {
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  let field: HTMLTextAreaElement | undefined;
  const submit = (blocked: string | undefined, to: (prompt: string) => Promise<void>) => {
    const prompt = field?.value.trim() ?? "";
    if (!prompt || pending() || blocked !== undefined) return;
    setPending(true);
    setError(undefined);
    to(prompt)
      .then(() => {
        if (field) field.value = "";
      })
      .catch((failure: unknown) => setError(String(failure)))
      .finally(() => setPending(false));
  };
  const send = () => submit(props.blocked(), props.onPrompt);
  const ask = () => submit(props.forkBlocked(), props.onFork);
  return (
    <div class="transcript-field">
      <textarea
        ref={(element) => (field = element)}
        rows={2}
        placeholder="Ask about the topic rather than one block. ⌘⏎ sends it to the agent; ⌘⇧⏎ asks a fork of its session."
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (event.shiftKey) ask();
            else send();
          }
        }}
      />
      <div class="transcript-field-actions">
        <div class="transcript-field-buttons">
          <button type="button" disabled={pending() || props.blocked() !== undefined} title={props.blocked() ?? "Send it to the agent"} onClick={send}>
            {pending() ? "…" : "Send"}
          </button>
          <button
            type="button"
            disabled={pending() || props.forkBlocked() !== undefined}
            title={props.forkBlocked() ?? "Ask a fork of the agent's session, which answers while the agent works"}
            onClick={ask}
          >
            Ask a fork
          </button>
        </div>
        <span class={["transcript-field-note", { error: error() !== undefined }]}>{error() ?? props.blocked() ?? ""}</span>
      </div>
    </div>
  );
}

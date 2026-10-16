import { For, Show, createEffect, createSignal, onSettled, untrack } from "solid-js";

import type { TranscriptEntry } from "@topic-overview/core/transcript";

import { parseDocument } from "../document.ts";
import { DocumentPiece } from "./AssetView.tsx";

// What the discussion's agent says and does, read from its session's
// transcript as it is written, and a field to tell it something about no
// block in particular. The terminal shows the same conversation; this panel
// is where I read it without leaving the page, and where a generic question
// is asked from. What I typed and what the agent replied are drawn in full,
// the reply as markdown; each tool it called is one line that unfolds to
// what it was given and what came back. The list follows the end while I
// am at it, and stays where I scrolled to otherwise.
export function TranscriptPanel(props: {
  entries: TranscriptEntry[];
  agent: string;
  blocked: () => string | undefined;
  onPrompt: (prompt: string) => Promise<void>;
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
      <PromptField blocked={props.blocked} onPrompt={props.onPrompt} />
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

// A prompt for the agent, typed into its window as it is. Writing it is
// always possible; sending waits until the agent is not working, as asking
// does, and the button says why it cannot be sent yet.
function PromptField(props: { blocked: () => string | undefined; onPrompt: (prompt: string) => Promise<void> }) {
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  let field: HTMLTextAreaElement | undefined;
  const send = () => {
    const prompt = field?.value.trim() ?? "";
    if (!prompt || pending() || props.blocked() !== undefined) return;
    setPending(true);
    setError(undefined);
    props
      .onPrompt(prompt)
      .then(() => {
        if (field) field.value = "";
      })
      .catch((failure: unknown) => setError(String(failure)))
      .finally(() => setPending(false));
  };
  return (
    <div class="transcript-field">
      <textarea
        ref={(element) => (field = element)}
        rows={2}
        placeholder="Tell the agent something, about no block in particular. ⌘⏎ sends it."
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
      />
      <div class="transcript-field-actions">
        <button type="button" disabled={pending() || props.blocked() !== undefined} title={props.blocked() ?? "Send it to the agent"} onClick={send}>
          {pending() ? "…" : "Send"}
        </button>
        <span class={["transcript-field-note", { error: error() !== undefined }]}>{error() ?? props.blocked() ?? ""}</span>
      </div>
    </div>
  );
}

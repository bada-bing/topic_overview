import { For, Show, createSignal } from "solid-js";

import { type Question, isFork } from "@topic-overview/core/question";

import { useEditing } from "../editing.ts";
import { blockedFor, standing, useQuestions } from "../questions.ts";
import { Text } from "./Text.tsx";
import { TextField } from "./TextField.tsx";

// A question I asked about a block, under the block until I dismiss it: an
// exchange of what I asked and what the agent answered, in order. Once the
// last answer has come, I can ask further. A block edited since I asked
// shows what it read when I asked, since the exchange is about that, and
// one the agent removed says so, under the line drawn in its place.
// A do is the agent asked to carry the block's item out. Its answer may
// suggest the marker the item carries now, which I apply with a button while
// the item is still in play; the agent never sets it. Once answered, a do
// is closed beside Ask further, as the ✕ dismisses it.
export function QuestionItem(props: { question: Question; text: string; removed?: boolean }) {
  const questions = useQuestions();
  const editing = useEditing();
  const isDo = () => props.question.kind === "do";
  const suggests = () => props.question.exchanges.at(-1)?.suggests;
  // The suggestion applies while the item still reads NOW or WAITING, not
  // what was suggested, and sits in the Action Plan.
  const applicable = () => {
    const marker = /^(NOW|WAITING) /.exec(props.text)?.[1];
    return marker !== undefined && marker !== suggests() && props.question.block !== undefined && questions.applies(props.question.block);
  };
  const [applyError, setApplyError] = createSignal<string | undefined>(undefined);
  const apply = async (marker: string) => {
    setApplyError(undefined);
    try {
      const own = await editing.load(props.question.block!);
      await editing.save(props.question.block!, own.replace(/^(NOW|WAITING) /, `${marker} `));
    } catch (failure) {
      setApplyError(String(failure));
    }
  };
  // What the block read when I asked, as the page shows a block's text: a
  // heading without its markers.
  const asked = () => (props.question.text ?? "").replace(/^#{1,6}\s+/, "");
  // A fork question never waits on the main agent.
  const blocked = () => blockedFor(props.question, questions);
  const [asking, setAsking] = createSignal(false);
  const answered = () => props.question.exchanges.at(-1)?.answer !== undefined;
  return (
    <div class={["question", { answered: answered() }]}>
      <div class="question-top">
        <span class="question-state-label">
          {isDo() ? "Do" : isFork(props.question) ? "Question to a fork" : "Question"} · {standing(props.question, questions.working())}
        </span>
        <button
          type="button"
          class="question-dismiss"
          title={blocked() ?? "Dismiss this question"}
          disabled={blocked() !== undefined}
          onClick={() => questions.dismiss(props.question)}
        >
          ✕
        </button>
      </div>
      <Show
        when={!props.removed}
        fallback={
          <div class="question-asked-about">
            <span class="question-asked-label">The agent removed this block since you asked. It read:</span>
            <Text text={asked()} />
          </div>
        }
      >
        <Show when={asked().trim() !== props.text.trim()}>
          <div class="question-asked-about">
            <span class="question-asked-label">This block has changed since you asked. Previously:</span>
            <Text text={asked()} />
          </div>
        </Show>
      </Show>
      <For each={props.question.exchanges}>
        {(exchange) => (
          <div class="question-exchange">
            <div class="question-turn mine">
              <span class="question-role">You</span>
              <div class="question-prompt">{exchange.prompt || (isDo() ? "Do this item." : "")}</div>
            </div>
            <div class="question-turn agent">
              <span class="question-role">Agent</span>
              <Show
                when={exchange.answer}
                fallback={
                  <div class="question-waiting">
                    {standing(props.question, questions.working()) === "being answered" ? "Being answered…" : "Waiting for the answer…"}
                  </div>
                }
              >
                {(answer) => (
                  <div class="question-answer">
                    <Text text={answer()} />
                  </div>
                )}
              </Show>
            </div>
          </div>
        )}
      </For>
      <Show when={answered() && suggests()}>
        {(marker) => (
          <div class={["question-suggestion", `state-${marker().toLowerCase()}`]}>
            <span class="question-role">Suggests</span>
            <span class="marker">{marker()}</span>
            <Show
              when={applicable()}
              fallback={
                <Show when={!props.text.startsWith(`${marker()} `)}>
                  <span class="question-suggestion-note">a step of Task Progress is advanced with the task skill</span>
                </Show>
              }
            >
              <button
                type="button"
                class="question-apply"
                title={editing.blocked() ?? `Mark the item ${marker()}`}
                disabled={editing.blocked() !== undefined}
                onClick={() => void apply(marker())}
              >
                Apply {marker()}
              </button>
            </Show>
            <Show when={applyError()}>
              <span class="error">{applyError()}</span>
            </Show>
          </div>
        )}
      </Show>
      <Show when={answered()}>
        <Show
          when={asking()}
          fallback={
            <div class="question-next">
              <button
                type="button"
                class="question-further"
                title={blocked() ?? "Ask further about this"}
                disabled={blocked() !== undefined}
                onClick={() => setAsking(true)}
              >
                Ask further
              </button>
              {/* A do ends where I finish reading it, as the ✕ ends it. */}
              <Show when={isDo()}>
                <button
                  type="button"
                  class="question-further"
                  title={blocked() ?? "Close this do; the item keeps its marker"}
                  disabled={blocked() !== undefined}
                  onClick={() => questions.dismiss(props.question)}
                >
                  Close
                </button>
              </Show>
            </div>
          }
        >
          <TextField
            action="Ask"
            onSave={async (prompt) => {
              await questions.followUp(props.question, prompt);
              setAsking(false);
            }}
            onCancel={() => setAsking(false)}
          />
        </Show>
      </Show>
    </div>
  );
}

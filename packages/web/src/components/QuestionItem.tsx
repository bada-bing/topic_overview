import { For, Show, createSignal } from "solid-js";

import type { Question } from "@topic-overview/core/question";

import { standing, useQuestions } from "../questions.ts";
import { Text } from "./Text.tsx";
import { TextField } from "./TextField.tsx";

// A question I asked about a block, under the block until I dismiss it: an
// exchange of what I asked and what the agent answered, in order. Once the
// last answer has come, I can ask further. A block edited since I asked
// shows what it read when I asked, since the exchange is about that.
export function QuestionItem(props: { question: Question; text: string }) {
  const questions = useQuestions();
  // What the block read when I asked, as the page shows a block's text: a
  // heading without its markers.
  const asked = () => props.question.text.replace(/^#{1,6}\s+/, "");
  const [asking, setAsking] = createSignal(false);
  const answered = () => props.question.exchanges.at(-1)?.answer !== undefined;
  return (
    <div class={["question", { answered: answered() }]}>
      <div class="question-top">
        <span class="question-state-label">Question · {standing(props.question, questions.working())}</span>
        <button
          type="button"
          class="question-dismiss"
          title={questions.blocked() ?? "Dismiss this question"}
          disabled={questions.blocked() !== undefined}
          onClick={() => questions.dismiss(props.question)}
        >
          ✕
        </button>
      </div>
      <Show when={asked().trim() !== props.text.trim()}>
        <div class="question-asked-about">
          <span class="question-asked-label">This block has changed since you asked. Previously:</span>
          <Text text={asked()} />
        </div>
      </Show>
      <For each={props.question.exchanges}>
        {(exchange) => (
          <div class="question-exchange">
            <div class="question-turn mine">
              <span class="question-role">You</span>
              <div class="question-prompt">{exchange.prompt}</div>
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
      <Show when={answered()}>
        <Show
          when={asking()}
          fallback={
            <button
              type="button"
              class="question-further"
              title={questions.blocked() ?? "Ask further about this"}
              disabled={questions.blocked() !== undefined}
              onClick={() => setAsking(true)}
            >
              Ask further
            </button>
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

import { For, Show, createSignal } from "solid-js";

import type { Question } from "@topic-overview/core/question";

import { useQuestions } from "../questions.ts";
import { Text } from "./Text.tsx";
import { TextField } from "./TextField.tsx";

// A question I asked about a block, under the block until I dismiss it: an
// exchange of what I asked and what the agent answered, in order. Once the
// last answer has come, I can ask further.
export function QuestionItem(props: { question: Question }) {
  const questions = useQuestions();
  const [asking, setAsking] = createSignal(false);
  const answered = () => props.question.exchanges.at(-1)?.answer !== undefined;
  return (
    <div class={["question", { answered: answered() }]}>
      <For each={props.question.exchanges}>
        {(exchange, index) => (
          <div class="question-exchange">
            <div class="question-head">
              <span class="question-prompt">{exchange.prompt}</span>
              <Show when={index() === 0}>
                <button
                  type="button"
                  class="question-dismiss"
                  title={questions.blocked() ?? "Dismiss this question"}
                  disabled={questions.blocked() !== undefined}
                  onClick={() => questions.dismiss(props.question)}
                >
                  ✕
                </button>
              </Show>
            </div>
            <Show when={exchange.answer} fallback={<div class="question-waiting">Waiting for the answer…</div>}>
              {(answer) => (
                <div class="question-answer">
                  <Text text={answer()} />
                </div>
              )}
            </Show>
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

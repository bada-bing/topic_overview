import { For, Show } from "solid-js";

import type { Block } from "@topic-overview/core";
import type { Question } from "@topic-overview/core/question";

import { standing, useQuestions } from "../questions.ts";
import { excerpt } from "./ChangeList.tsx";
import { Text } from "./Text.tsx";

// The questions I asked about blocks, listed as the changes are and behaving
// as they do: each says where it stands and what I asked last, choosing it
// opens the way to its block, and its check dismisses it, as the ✕ under the
// block does. Hovering the check shows the last answer.
export function QuestionList(props: { questions: Question[]; blockOf: (question: Question) => Block | undefined; working: boolean }) {
  const questions = useQuestions();
  return (
    <Show when={props.questions.length > 0}>
      <section class="comment-list change-list question-list">
        <h3>Questions ({props.questions.length})</h3>
        <For each={props.questions}>
          {(question) => {
            const last = () => question.exchanges.at(-1)!;
            const state = () => standing(question, props.working);
            return (
              <div class="change-list-entry">
                <a class={["comment-list-entry", state() === "answered" ? "question-answered" : "question-open"]} href={`#${question.block}`}>
                  <span class="comment-list-block">{state()}</span>
                  <span class="comment-list-body">{excerpt(last().prompt)}</span>
                </a>
                <span class={["mark-seen-wrap", "has-preview", "inline"]}>
                  <button
                    type="button"
                    class={["mark-seen", state() === "answered" ? "question-answered" : "question-open"]}
                    title={questions.blocked()}
                    disabled={questions.blocked() !== undefined}
                    onClick={() => questions.dismiss(question)}
                  >
                    ✓
                  </button>
                  <span class="preview mark-before">
                    <strong>The check dismisses this question.</strong>
                    <Show when={last().answer} fallback={<span class="mark-before-none">Not answered yet.</span>}>
                      {(answer) => (
                        <>
                          <span class="mark-before-label">The answer:</span>
                          <span>
                            <Text text={answer()} />
                          </span>
                        </>
                      )}
                    </Show>
                  </span>
                </span>
              </div>
            );
          }}
        </For>
      </section>
    </Show>
  );
}

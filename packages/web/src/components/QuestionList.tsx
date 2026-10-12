import { For, Show } from "solid-js";

import type { Block } from "@topic-overview/core";
import type { Question } from "@topic-overview/core/question";

import { excerpt } from "./ChangeList.tsx";

// The questions I asked about blocks, so I know where an answer waits.
// Choosing one opens the way to its block, where the exchange is. Each says
// what I asked last and whether the agent has answered it.
export function QuestionList(props: { questions: Question[]; blockOf: (question: Question) => Block | undefined }) {
  return (
    <Show when={props.questions.length > 0}>
      <section class="comment-list question-list">
        <h3>Questions ({props.questions.length})</h3>
        <For each={props.questions}>
          {(question) => {
            const last = () => question.exchanges.at(-1)!;
            return (
              <a
                class={["comment-list-entry", "question-entry", { answered: last().answer !== undefined }]}
                href={`#${question.block}`}
              >
                <span class="comment-list-block">
                  {excerpt(props.blockOf(question)?.text ?? question.text)}
                </span>
                <span class="comment-list-body">{excerpt(last().prompt)}</span>
                <span class="question-state">{last().answer !== undefined ? "answered" : "waiting for the answer"}</span>
              </a>
            );
          }}
        </For>
      </section>
    </Show>
  );
}

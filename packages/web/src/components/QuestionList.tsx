import { For, Show } from "solid-js";

import type { Block } from "@topic-overview/core";
import type { Question } from "@topic-overview/core/question";

import { standing } from "../questions.ts";
import { excerpt } from "./ChangeList.tsx";

// The questions I asked about blocks, so I know where an answer waits.
// Choosing one opens the way to its block, where the exchange is. Each says
// what I asked last and where it stands: answered, being answered, or
// waiting for the agent.
export function QuestionList(props: { questions: Question[]; blockOf: (question: Question) => Block | undefined; working: boolean }) {
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
                <span class="question-state">{standing(question, props.working)}</span>
              </a>
            );
          }}
        </For>
      </section>
    </Show>
  );
}

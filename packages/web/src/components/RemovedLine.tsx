import { For } from "solid-js";

import type { Mark } from "@topic-overview/core";

import { useMarks } from "../marks.ts";
import { useQuestions } from "../questions.ts";
import { MarkSeen } from "./MarkSeen.tsx";
import { QuestionItem } from "./QuestionItem.tsx";

// Why a removed block's line cannot be confirmed away yet: the line is where
// the questions about the block are read.
export const HELD_BY_QUESTION = "A question about this block is still open; dismiss it first";

// Where the agent removed a block: a red line in its place, with the check
// that confirms I saw it, and what it read on the check's hover. The
// questions I asked about the block stay under the line until I dismiss
// them, and the line stays while they do.
export function RemovedLine(props: { mark: Mark }) {
  const marks = useMarks();
  const questions = useQuestions();
  const asked = () => (props.mark.id ? questions.of(props.mark.id) : []);
  return (
    <div class="removed-line">
      <hr />
      <MarkSeen mark={props.mark} onSeen={() => marks.clear(props.mark)} held={asked().length > 0 ? HELD_BY_QUESTION : undefined} />
      <For each={asked()} keyed={(question) => question.id}>
        {(question) => <QuestionItem question={question()} text={props.mark.text ?? ""} removed />}
      </For>
    </div>
  );
}

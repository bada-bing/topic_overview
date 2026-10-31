import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import { useQuestions } from "../questions.ts";
import type { TaskHeader as Header } from "../task.ts";
import { Text } from "./Text.tsx";

// Where a task stands, kept in view however deep into the page I am: the
// key and the phase, coloured by the status, the title, and below it the
// active step and the NOW items of the Action Plan, each a link to its block,
// and the WAITING ones, which wait on somebody else. Beside each, ▶ asks the
// agent to do it, opening the field for a note under its block.
// The active work follows the phase, as the status bar shows it beside the
// task. The agents sit at the right, apart from the work: the discussion's
// line, which brings its session's window up in the terminal when a Claude
// session runs it, and under it the other open discussions.
export function TaskHeader(props: { task: Header; discussion: string; onDiscussion?: () => void; work?: JSX.Element; others?: JSX.Element }) {
  const questions = useQuestions();
  return (
    <header class="task-header">
      <div class="task-meta">
        <span class="task-key">{props.task.key}</span>
        <span class={["task-phase", `status-${props.task.status.toLowerCase()}`]}>{props.task.phase}</span>
        {props.work}
        <div class="task-agents">
          <Show when={props.onDiscussion} fallback={<span class="task-discussion">{props.discussion}</span>}>
            {(open) => (
              <button type="button" class="task-discussion" title="Open the agent's window in the terminal" onClick={() => open()()}>
                {props.discussion}
              </button>
            )}
          </Show>
          {props.others}
        </div>
      </div>
      <div class="task-title">{props.task.title}</div>
      <Show when={props.task.steps.length + props.task.actions.length > 0}>
        <div class="task-now">
          <For each={[...props.task.steps, ...props.task.actions]}>
            {(item) => (
              <span class="task-now-entry">
                <a href={`#${item.id}`} class={["task-now-item", `marker-${item.marker.toLowerCase()}`]}>
                  <Text text={item.text} />
                </a>
                <Show when={questions.available}>
                  <button
                    type="button"
                    class="task-do"
                    title={questions.blocked() ?? "Do this item: the agent carries it out and reports what is done, open or waited on"}
                    disabled={questions.blocked() !== undefined}
                    onClick={() => questions.startDo(item.id)}
                  >
                    ▶
                  </button>
                </Show>
              </span>
            )}
          </For>
        </div>
      </Show>
    </header>
  );
}

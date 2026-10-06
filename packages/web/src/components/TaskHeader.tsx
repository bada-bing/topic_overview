import { For, Show } from "solid-js";

import type { TaskHeader as Header } from "../task.ts";
import { Text } from "./Text.tsx";

// Where a task stands, kept in view however deep into the page I am: the
// key and the phase, coloured by the status, the title, and below it the
// active step and the NOW items of the Action Plan, each a link to its block.
export function TaskHeader(props: { task: Header; discussion: string }) {
  return (
    <header class="task-header">
      <div class="task-meta">
        <span class="task-key">{props.task.key}</span>
        <span class={["task-phase", `status-${props.task.status.toLowerCase()}`]}>{props.task.phase}</span>
        <span class="task-discussion">{props.discussion}</span>
      </div>
      <div class="task-title">{props.task.title}</div>
      <Show when={props.task.steps.length + props.task.actions.length > 0}>
        <div class="task-now">
          <For each={[...props.task.steps, ...props.task.actions]}>
            {(item) => (
              <a href={`#${item.id}`} class="task-now-item">
                <Text text={item.text} />
              </a>
            )}
          </For>
        </div>
      </Show>
    </header>
  );
}

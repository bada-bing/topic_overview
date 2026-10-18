import { Show } from "solid-js";

import type { Work } from "@topic-overview/core";

// What a discussion's agent is doing, in words.
export const AGENT_STATES: Record<string, string> = {
  busy: "working",
  waiting: "waiting for you",
  idle: "idle",
  gone: "no Claude session",
};

// The active work, as the tmux status bar shows it: what is being recorded
// and for how long. What is recorded is named only when it is not this
// topic, since the header names the topic already. Nothing is known of the
// work until the server has read it once.
export function WorkLine(props: { work: Work | undefined; topic: string }) {
  const elsewhere = () => props.work?.kind === "task" && props.work.identity !== props.topic;
  return (
    <Show when={props.work}>
      {(work) => (
        <span class={["work-line", `work-${work().kind}`]} title={title(work())}>
          <Show when={work().kind !== "none"} fallback={<span class="muted">no active work</span>}>
            <span class="work-elapsed">⏱ {work().elapsed ?? "0:00"}</span>
            <Show when={work().kind === "unlabelled"}>
              <span class="work-what">unlabelled work</span>
            </Show>
            <Show when={work().kind === "adhoc"}>
              <span class="work-what">{work().identity}</span>
            </Show>
            <Show when={elsewhere()}>
              <span class="work-what">on {work().identity}</span>
            </Show>
          </Show>
        </span>
      )}
    </Show>
  );
}

function title(work: Work): string {
  if (work.kind === "none") return "Nothing is being recorded";
  if (work.kind === "unlabelled") return "An interval is open that carries no identity";
  if (work.kind === "adhoc") return `Recording work with no task: ${work.identity}`;
  return [`Recording ${work.identity}`, work.step && `step ${work.step}`, work.now && `NOW ${work.now}`].filter(Boolean).join(" · ");
}

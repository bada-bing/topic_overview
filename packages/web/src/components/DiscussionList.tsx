import { For } from "solid-js";

import type { DiscussionAgent } from "@topic-overview/core";

import { AGENT_STATES } from "./Status.tsx";

// The other open discussions, each with its agent's state, under the
// discussion's own line in the header: while I wait on this one, it shows
// when another wants me. The key opens that discussion's page, and the
// state brings its agent's window up in the terminal, while a Claude
// session runs there.
export function DiscussionList(props: { discussions: DiscussionAgent[]; onFocus: (key: string) => void }) {
  return (
    <For each={props.discussions} keyed={(discussion) => discussion.key}>
      {(discussion) => (
        <span class={["discussion-entry", `agent-${discussion().state}`]}>
          <a class="discussion-key" href={`/d/${encodeURIComponent(discussion().key)}`} title="Open its page">
            {discussion().key}
          </a>
          {" · "}
          <button
            type="button"
            class="discussion-state"
            disabled={discussion().state === "gone"}
            title={discussion().name ? `Open ${discussion().name} in the terminal` : "No Claude session runs there"}
            onClick={() => props.onFocus(discussion().key)}
          >
            {AGENT_STATES[discussion().state]}
          </button>
        </span>
      )}
    </For>
  );
}

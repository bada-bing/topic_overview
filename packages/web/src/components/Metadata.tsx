import { For, Show } from "solid-js";

import type { DiscussionView } from "@topic-overview/core";

import { frontmatter } from "../task.ts";

// Section 0, right after the header and folded: the source file, the worktree
// it is checked out in, when the discussion was opened, the Claude session it
// belongs to, and the frontmatter. The worktree and the session each bring
// their tmux window up.
export function Metadata(props: {
  view: DiscussionView;
  open: boolean;
  onToggle: () => void;
  agent?: string; // the Claude session the discussion belongs to, and what it does
  onAgent?: () => void;
  onWorktree?: () => void;
}) {
  const fields = () => Object.entries(frontmatter(props.view.page));
  const when = (time: string) => new Date(time).toLocaleString();
  return (
    <section class={["section", "metadata", { open: props.open }]}>
      <h2 id="metadata" class="section-heading">
        <button type="button" class="section-toggle" aria-expanded={props.open ? "true" : "false"} onClick={() => props.onToggle()}>
          <span class="fold">{props.open ? "▾" : "▸"}</span>
          Metadata
        </button>
      </h2>
      <Show when={props.open}>
        <dl class="metadata-list">
          <dt>Source</dt>
          <dd>
            <code>{props.view.source}</code>
          </dd>
          <dt>Worktree</dt>
          <dd>
            <button type="button" class="metadata-open" title="Open a window in the worktree" onClick={() => props.onWorktree?.()}>
              <code>{props.view.worktree}</code>
            </button>
            <div class="muted">
              on <code>{props.view.branch}</code>
            </div>
          </dd>
          <dt>Opened</dt>
          <dd>{when(props.view.opened)}</dd>
          <dt>Claude session</dt>
          <dd>
            <Show when={props.onAgent} fallback={<span class="muted">{props.agent ?? "none"}</span>}>
              {(open) => (
                <button type="button" class="metadata-open" title="Open the agent's window in the terminal" onClick={() => open()()}>
                  {props.agent}
                </button>
              )}
            </Show>
            <Show when={props.view.session}>
              {(session) => (
                <div class="muted">
                  <code>{session().id}</code>
                </div>
              )}
            </Show>
          </dd>
          <Show when={fields().length > 0}>
            <dt>Frontmatter</dt>
            <dd>
              <For each={fields()}>
                {([key, value]) => (
                  <div>
                    {key}: {value}
                  </div>
                )}
              </For>
            </dd>
          </Show>
        </dl>
      </Show>
    </section>
  );
}

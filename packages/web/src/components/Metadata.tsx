import { For, Show } from "solid-js";

import type { DiscussionView } from "@topic-overview/core";
import { stateText } from "@topic-overview/core/discussion";

import { frontmatter } from "../task.ts";

// Section 0, right after the header and folded. For a discussion on the
// source itself: the source file, the worktree it is checked out in, when it
// was opened, the Claude session it belongs to, and the frontmatter; the
// worktree and the session each bring their tmux window up. For a copy: what
// it is a copy of, the frontmatter it came with, the Claude sessions that
// worked on it, and the other discussions of the same source.
export function Metadata(props: {
  view: DiscussionView;
  open: boolean;
  onToggle: () => void;
  agent?: string; // the Claude session the discussion belongs to, and what it does
  onAgent?: () => void;
  onWorktree?: () => void;
}) {
  const fields = () => Object.entries(frontmatter(props.view.page));
  const when = (time: string | null) => (time ? new Date(time).toLocaleString() : "");
  return (
    <section class={["section", "metadata", { open: props.open }]}>
      <h2 id="metadata" class="section-heading">
        <button type="button" class="section-toggle" aria-expanded={props.open ? "true" : "false"} onClick={() => props.onToggle()}>
          <span class="fold">{props.open ? "▾" : "▸"}</span>
          Metadata
        </button>
      </h2>
      <Show when={props.open && props.view.branch}>
        <dl class="metadata-list">
          <dt>Source</dt>
          <dd>
            <code>{props.view.discussion.source}</code>
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
          <dd>{when(props.view.discussion.opened)}</dd>
          <dt>Claude session</dt>
          <dd>
            <Show when={props.onAgent} fallback={<span class="muted">{props.agent ?? "none"}</span>}>
              {(open) => (
                <button type="button" class="metadata-open" title="Open the agent's window in the terminal" onClick={() => open()()}>
                  {props.agent}
                </button>
              )}
            </Show>
            <For each={props.view.discussion.sessions}>
              {(session) => (
                <div class="muted">
                  <code>{session.id}</code>
                </div>
              )}
            </For>
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
      <Show when={props.open && !props.view.branch}>
        <dl class="metadata-list">
          <dt>Source</dt>
          <dd>
            <code>{props.view.discussion.source}</code>
          </dd>
          <dt>Opened</dt>
          <dd>
            {when(props.view.discussion.opened)}, now at version {props.view.discussion.version}
            {props.view.discussion.closed
              ? `, ${stateText(props.view.discussion).replace("closed", `closed ${when(props.view.discussion.closed)}`)}`
              : ""}
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
          <dt>Claude sessions</dt>
          <dd>
            <Show when={props.view.discussion.sessions.length > 0} fallback={<span class="muted">none recorded</span>}>
              <For each={props.view.discussion.sessions}>
                {(session) => (
                  <div>
                    <code>{session.id}</code>
                    <div class="muted">
                      <code>{session.transcript}</code>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </dd>
          <dt>Earlier discussions</dt>
          <dd>
            <Show when={props.view.earlier.length > 0} fallback={<span class="muted">none</span>}>
              <For each={props.view.earlier}>
                {(other) => (
                  <div>
                    <a href={`/d/${encodeURIComponent(props.view.ref.source)}/${encodeURIComponent(other.startedAt)}`}>
                      {other.startedAt}
                    </a>
                    <span class="muted">
                      {" "}
                      · version {other.version}
                      {" · "}
                      {stateText(other)}
                    </span>
                  </div>
                )}
              </For>
            </Show>
          </dd>
        </dl>
      </Show>
    </section>
  );
}

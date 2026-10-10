import { For, Show } from "solid-js";

import type { DiscussionView } from "@topic-overview/core";

import { frontmatter } from "../task.ts";

// Section 0, right after the header and folded: what the discussion is a
// copy of, the frontmatter it came with, the Claude sessions that worked on
// it, and the other discussions of the same source. Its design waits for
// the page's design to be revisited.
export function Metadata(props: { view: DiscussionView; open: boolean; onToggle: () => void }) {
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
      <Show when={props.open}>
        <dl class="metadata-list">
          <dt>Source</dt>
          <dd>
            <code>{props.view.discussion.source}</code>
          </dd>
          <dt>Opened</dt>
          <dd>
            {when(props.view.discussion.opened)}, now at version {props.view.discussion.version}
            {props.view.discussion.closed ? `, closed ${when(props.view.discussion.closed)}` : ""}
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
                      {other.closed ? " · closed" : " · open"}
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

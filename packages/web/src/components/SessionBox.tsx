import { For, Show, createMemo, createSignal } from "solid-js";

import type { TopicSession, TopicSessions } from "@topic-overview/core";

import { readAnswer } from "../http.ts";
import { AGENT_STATES } from "./Status.tsx";

// The topic's agent sessions, read off the session store: each with when it
// started and was last used, its title, its note or else its first prompt,
// and, while it runs, the window it runs in and what it does there. A
// session that does not run is resumed in a new window of the topic's tmux
// session; one that runs has its window brought up. Start opens a fresh
// session there. The one-shots close the list as a count. It is read again
// whenever the discussion's agent changes state. What an action refused
// shows on its button's title until the next try, as an integration's does.
export function SessionBox(props: { base: string; version: number }) {
  const sessions = createMemo(() => fetchSessions(props.base, props.version));
  const act = async (path: string, action: string) => {
    await readAnswer(await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }));
  };
  return (
    <Show when={sessions().sessions.length + sessions().oneShots.count > 0}>
      <section class="list-box session-box">
        <h3>
          Sessions
          <ActionButton class="session-start" label="start" title="Start a new session in the topic's tmux session" run={() => act(`${props.base}/sessions`, "start")} />
        </h3>
        <For each={sessions().sessions} keyed={(session) => session.id}>
          {(session) => (
            <div class={["session-row", { running: !!session().running }, session().running ? `agent-${session().running!.state}` : ""]} title={`${session().id}\n${session().directory}`}>
              <span class="session-when">{when(session())}</span>
              <span class="session-title">{session().title || <span class="muted">untitled</span>}</span>
              <Show
                when={session().running}
                fallback={
                  <ActionButton class="session-action" label="resume" title="Resume it in a new window of the topic's tmux session" run={() => act(`${props.base}/sessions/${encodeURIComponent(session().id)}`, "resume")} />
                }
              >
                {(running) => (
                  <ActionButton class="session-action" label={AGENT_STATES[running().state]} title={`Open ${running().window} in the terminal`} run={() => act(`${props.base}/sessions/${encodeURIComponent(session().id)}`, "focus")} />
                )}
              </Show>
              <span class="session-about muted">{session().note ?? session().prompt ?? ""}</span>
            </div>
          )}
        </For>
        <Show when={sessions().oneShots.count > 0}>
          <div class="session-row muted">
            <span class="session-when">{oneShotSpan(sessions().oneShots)}</span>
            <span class="session-title">{sessions().oneShots.count === 1 ? "1 one-shot" : `${sessions().oneShots.count} one-shots`}</span>
          </div>
        </Show>
      </section>
    </Show>
  );
}

// A button that does something to a session. What failed shows on its
// title until the next try.
function ActionButton(props: { class: string; label: string; title: string; run: () => Promise<void> }) {
  const [pending, setPending] = createSignal(false);
  const [failure, setFailure] = createSignal<string | undefined>(undefined);
  const run = () => {
    setPending(true);
    setFailure(undefined);
    props
      .run()
      .catch((error: Error) => setFailure(error.message))
      .finally(() => setPending(false));
  };
  return (
    <button type="button" class={[props.class, { failed: failure() !== undefined }]} disabled={pending()} title={failure() ?? props.title} onClick={run}>
      {pending() ? "…" : props.label}
    </button>
  );
}

async function fetchSessions(base: string, _version: number): Promise<TopicSessions> {
  return readAnswer<TopicSessions>(await fetch(`${base}/sessions`, { cache: "no-store" }));
}

// When a session started and was last used, on one line: the day and time
// of the start, then the time of the last use, with its day when it is
// another. Nothing is known of a session whose transcript is gone.
function when(session: TopicSession): string {
  if (!session.started) return "transcript gone";
  const started = new Date(session.started);
  const used = session.used ? new Date(session.used) : undefined;
  const start = `${day(started)} ${time(started)}`;
  if (!used) return start;
  return `${start} – ${sameDay(started, used) ? "" : `${day(used)} `}${time(used)}`;
}

function oneShotSpan(oneShots: { from?: string; to?: string }): string {
  if (!oneShots.from) return "";
  const from = new Date(oneShots.from);
  const to = oneShots.to ? new Date(oneShots.to) : from;
  return `${day(from)} ${time(from)} – ${sameDay(from, to) ? "" : `${day(to)} `}${time(to)}`;
}

function day(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// 24-hour time, as the listing and the journal write it.
function time(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

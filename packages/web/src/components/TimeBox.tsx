import { For, Show, createMemo } from "solid-js";

import type { TaskTime } from "@topic-overview/core";

import { readAnswer } from "../http.ts";

// How many days are listed before the rest is summed into one line.
const DAYS_SHOWN = 10;

// When the task was worked on, read from Timewarrior through the task's
// identity: the total, then each day with its time and how many intervals it
// took, newest first. The day whose interval is still running is marked. It
// is read again while the clock runs on this topic, and once more when it
// stops, so the running day keeps up and a stopped interval shows at once.
// Hovering a day lists its intervals, each with its times.
export function TimeBox(props: { base: string; version: number }) {
  const time = createMemo(() => fetchTime(props.base, props.version));
  const shown = () => time().days.slice(0, DAYS_SHOWN);
  const rest = () => time().days.slice(DAYS_SHOWN);
  return (
    <Show when={time().days.length > 0}>
      <section class="list-box time-box">
        <h3>
          Worked on <span class="time-total">{duration(time().minutes)}</span>
        </h3>
        <For each={shown()} keyed={(day) => day.date}>
          {(day) => (
            <div class={["time-day", "has-preview", { open: !!day().open }]}>
              <span class="time-date">{dayName(day().date)}</span>
              <span class="time-minutes">{duration(day().minutes)}</span>
              <span class="time-count muted">{day().intervals === 1 ? "1 interval" : `${day().intervals} intervals`}</span>
              <span class="preview time-spans">
                <For each={day().spans}>
                  {(span) => (
                    <span class={["preview-line", "time-span", { open: span.end === undefined }]}>
                      <span class="time-span-when">
                        {span.start} – {span.end ?? "now"}
                      </span>
                      <span class="time-span-minutes">{duration(span.minutes)}</span>
                    </span>
                  )}
                </For>
              </span>
            </div>
          )}
        </For>
        <Show when={rest().length > 0}>
          <div class="time-day muted">
            <span class="time-date">{rest().length} more days</span>
            <span class="time-minutes">{duration(rest().reduce((sum, day) => sum + day.minutes, 0))}</span>
          </div>
        </Show>
      </section>
    </Show>
  );
}

async function fetchTime(base: string, _version: number): Promise<TaskTime> {
  return readAnswer<TaskTime>(await fetch(`${base}/time`, { cache: "no-store" }));
}

// A duration as the journal writes it: 2h, 2h30m, 45m.
export function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}m`;
}

// A local date, YYYY-MM-DD, as a short day name: today, yesterday, or the
// weekday and date.
function dayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(day, today)) return "today";
  if (sameDay(day, yesterday)) return "yesterday";
  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

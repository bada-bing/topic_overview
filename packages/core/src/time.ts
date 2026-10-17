// When a task was worked on, read from Timewarrior: the intervals carrying
// the task's identity, the `%<key>` tag `work` writes, as `timew export :all
// %<key>` lists them, summed by local day with the total. Timewarrior stores
// UTC, so an evening interval is placed on the local day it happened, and one
// reaching past midnight is cut at the day's edge, as the journal's Work
// block cuts it.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface TimewInterval {
  start: string; // 20261012T070000Z
  end?: string; // none while the interval is open
  tags?: string[];
}

export interface DayTime {
  date: string; // local, YYYY-MM-DD
  minutes: number;
  intervals: number;
  open?: boolean; // an interval of this day is still running
  spans: Span[]; // the day's intervals in order, as cut to the day
}

export interface Span {
  start: string; // local, HH:MM
  end?: string; // none while the interval is open
  minutes: number;
}

export interface TaskTime {
  minutes: number; // the total
  days: DayTime[]; // newest first
}

// Timewarrior's compact UTC form, 20261012T070000Z, as a date.
export function parseTimewDate(text: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(text);
  if (!match) throw new Error(`not a Timewarrior date: ${text}`);
  const [, y, mo, d, h, mi, s] = match.map(Number) as unknown as number[];
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

function localTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Midnight after the moment, in local time.
function nextMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function summarizeIntervals(intervals: TimewInterval[], now: Date = new Date()): TaskTime {
  const days = new Map<string, DayTime>();
  for (const interval of intervals) {
    const open = interval.end === undefined;
    const end = open ? now : parseTimewDate(interval.end!);
    let from = parseTimewDate(interval.start);
    let first = true;
    while (from < end) {
      const edge = nextMidnight(from);
      const to = edge < end ? edge : end;
      const date = localDate(from);
      const day = days.get(date) ?? { date, minutes: 0, intervals: 0, spans: [] };
      const minutes = Math.round((to.getTime() - from.getTime()) / 60_000);
      day.minutes += minutes;
      if (first) day.intervals += 1;
      const running = open && to === end;
      if (running) day.open = true;
      // A span cut at midnight ends at 24:00 rather than at 00:00 of the next day.
      day.spans.push({ start: localTime(from), ...(running ? {} : { end: to === edge ? "24:00" : localTime(to) }), minutes });
      days.set(date, day);
      from = to;
      first = false;
    }
  }
  for (const day of days.values()) day.spans.sort((a, b) => a.start.localeCompare(b.start));
  const sorted = [...days.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { minutes: sorted.reduce((sum, day) => sum + day.minutes, 0), days: sorted };
}

// Without Timewarrior, or without intervals, the task has no recorded time.
export async function taskTime(key: string, now: Date = new Date()): Promise<TaskTime> {
  const { stdout } = await run("timew", ["export", ":all", `%${key}`]).catch(() => ({ stdout: "[]" }));
  let intervals: TimewInterval[];
  try {
    intervals = JSON.parse(stdout) as TimewInterval[];
  } catch {
    intervals = [];
  }
  return summarizeIntervals(intervals, now);
}

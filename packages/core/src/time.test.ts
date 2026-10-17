import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTimewDate, summarizeIntervals } from "./time.ts";

// The tests run in the machine's zone; the dates below keep clear of its
// midnight by sitting in the middle of a UTC day.
const at = (date: Date, hours: number, minutes = 0) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes).toISOString().replace(/[-:]|\.\d{3}/g, "");

test("a Timewarrior date is read as UTC", () => {
  assert.equal(parseTimewDate("20261012T070000Z").toISOString(), "2026-10-12T07:00:00.000Z");
});

test("intervals are summed by local day, newest first, with the total", () => {
  const day1 = new Date(2026, 9, 12);
  const day2 = new Date(2026, 9, 14);
  const time = summarizeIntervals([
    { start: at(day1, 9), end: at(day1, 10, 30) },
    { start: at(day1, 11), end: at(day1, 11, 45) },
    { start: at(day2, 14), end: at(day2, 16) },
  ]);
  assert.deepEqual(time, {
    minutes: 90 + 45 + 120,
    days: [
      { date: "2026-10-14", minutes: 120, intervals: 1, spans: [{ start: "14:00", end: "16:00", minutes: 120 }] },
      {
        date: "2026-10-12",
        minutes: 135,
        intervals: 2,
        spans: [
          { start: "09:00", end: "10:30", minutes: 90 },
          { start: "11:00", end: "11:45", minutes: 45 },
        ],
      },
    ],
  });
});

test("an interval reaching past midnight is cut at the day's edge", () => {
  const day = new Date(2026, 9, 12);
  const next = new Date(2026, 9, 13);
  const time = summarizeIntervals([{ start: at(day, 22), end: at(next, 1) }]);
  assert.deepEqual(time.days, [
    { date: "2026-10-13", minutes: 60, intervals: 0, spans: [{ start: "00:00", end: "01:00", minutes: 60 }] },
    { date: "2026-10-12", minutes: 120, intervals: 1, spans: [{ start: "22:00", end: "24:00", minutes: 120 }] },
  ]);
});

test("an open interval counts up to now and marks its day", () => {
  const day = new Date(2026, 9, 16);
  const now = new Date(2026, 9, 16, 12, 20);
  const time = summarizeIntervals([{ start: at(day, 12) }], now);
  assert.deepEqual(time.days, [{ date: "2026-10-16", minutes: 20, intervals: 1, open: true, spans: [{ start: "12:00", minutes: 20 }] }]);
});

// A Claude session's transcript followed as it is written: the file is read
// whole once, then from where the last read ended each time it grows, and
// what the new lines hold goes to the caller. Claude Code appends an entry
// as each content block completes, so a tool call shows within a second
// and a reply as a whole once it is finished.

import { type FSWatcher, watch as watchFiles } from "node:fs";
import { open } from "node:fs/promises";
import { basename, dirname } from "node:path";

import { type TranscriptEntry, parseTranscriptLine } from "@topic-overview/core";

// A write lands in steps; one read follows the last.
const SETTLE = 150;
// How many entries are kept for a page that joins: the recent part of a
// long session, not all of it.
export const KEPT = 400;

export interface Tail {
  stop: () => void;
}

// `onEntries` is told what the file holds, first with everything read so far,
// `replace` set, then what each later write adds. A file that shrinks, as
// when it is replaced, is read whole again.
export function tailTranscript(path: string, onEntries: (entries: TranscriptEntry[], replace: boolean) => void): Tail {
  let offset = 0;
  // The bytes after the last line break, kept until the line is complete, so
  // a character split across two writes is never decoded in halves.
  let remainder = Buffer.alloc(0);
  let reading = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const read = async () => {
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    try {
      const handle = await open(path, "r");
      try {
        const { size } = await handle.stat();
        const replace = size < offset || offset === 0;
        if (size < offset) {
          offset = 0;
          remainder = Buffer.alloc(0);
        }
        if (size === offset) {
          if (replace) onEntries([], true);
          return;
        }
        const buffer = Buffer.alloc(size - offset);
        await handle.read(buffer, 0, buffer.length, offset);
        offset = size;
        const chunk = Buffer.concat([remainder, buffer]);
        const last = chunk.lastIndexOf(0x0a);
        if (last === -1) {
          remainder = chunk;
          if (replace) onEntries([], true);
          return;
        }
        remainder = chunk.subarray(last + 1);
        const entries = chunk.subarray(0, last).toString("utf8").split("\n").flatMap(parseTranscriptLine);
        if (!stopped) onEntries(entries, replace);
      } finally {
        await handle.close();
      }
    } catch {
      // A file not there yet, or gone, is read when it is next written.
    } finally {
      reading = false;
      if (again) {
        again = false;
        void read();
      }
    }
  };
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void read(), SETTLE);
  };
  // The folder is watched rather than the file, so a file not written yet is
  // found once it is.
  let watcher: FSWatcher | undefined;
  try {
    watcher = watchFiles(dirname(path), (_event, name) => {
      if (name === basename(path)) changed();
    });
  } catch {
    // A folder that does not exist has nothing to follow yet.
  }
  void read();
  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      watcher?.close();
    },
  };
}

// Changes from outside. While a page is open on a discussion, the server
// watches the discussion's source and its own files, and tells the page what
// changed as a server-sent event. A side that changes something elsewhere
// announces it, and the page is told the same way.

import { type FSWatcher, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { basename, dirname } from "node:path";

import { type DiscussionRef, type Store, fingerprint, pageLinks, parsePage, sourceChanged } from "@topic-overview/core";

import { kbPages, pageFile } from "./kb.ts";

// A change to the discussion's own content blocks the page until it is
// reloaded; a change to a linked page, or an announced one, is information.
export type Change =
  | { kind: "source"; message: string } // reloading opens a new discussion on the source
  | { kind: "version"; message: string } // reloading shows the new version
  | { kind: "linked"; page: string; message: string } // a page the discussion links to
  | { kind: "info"; message: string }; // announced by a side, such as a merged merge request

const HEARTBEAT = 20_000;
// Editors write a file in several steps; one notice follows the last of them.
const SETTLE = 300;

interface Watched {
  pages: Set<ServerResponse>;
  watchers: FSWatcher[];
  version: number;
  timer?: ReturnType<typeof setTimeout>;
}

export class Changes {
  private readonly watched = new Map<string, Watched>();
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  // An open page subscribes; the stream stays open until the page goes.
  async subscribe(ref: DiscussionRef, response: ServerResponse): Promise<void> {
    response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    response.write(": connected\n\n");
    const key = keyOf(ref);
    let entry = this.watched.get(key);
    if (!entry) {
      entry = await this.watch(ref);
      this.watched.set(key, entry);
    }
    entry.pages.add(response);
    // A source that changed while no page was open is told at once, so the
    // page never shows a copy that is already out of date.
    const { discussion } = await this.store.read(ref);
    if (!discussion.closed && (await sourceChanged(discussion.source, discussion.sourceHash))) {
      const change: Change = { kind: "source", message: "The source of this discussion has changed since it was opened." };
      response.write(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
    }
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), HEARTBEAT);
    response.on("close", () => {
      clearInterval(heartbeat);
      this.unsubscribe(key, response);
    });
  }

  // A change a side announces, such as a merged merge request.
  announce(ref: DiscussionRef, message: string): number {
    return this.notify(keyOf(ref), { kind: "info", message });
  }

  private async watch(ref: DiscussionRef): Promise<Watched> {
    const { discussion } = await this.store.read(ref);
    const entry: Watched = { pages: new Set(), watchers: [], version: discussion.version };
    const key = keyOf(ref);
    const settle = (check: () => Promise<void>) => {
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => void check().catch(() => {}), SETTLE);
    };

    // The directory is watched rather than the file, since an editor often
    // replaces a file instead of writing into it.
    const sourceFile = basename(discussion.source);
    entry.watchers.push(
      watch(dirname(discussion.source), (_event, file) => {
        if (file !== sourceFile) return;
        settle(async () => {
          if (await sourceChanged(discussion.source, discussion.sourceHash)) {
            this.notify(key, { kind: "source", message: "The source of this discussion has changed." });
          }
        });
      }),
    );
    entry.watchers.push(
      watch(this.store.directory(ref), (_event, file) => {
        if (file !== "discussion.json") return;
        settle(async () => {
          const { discussion: now } = await this.store.read(ref);
          if (now.version !== entry.version) {
            entry.version = now.version;
            this.notify(key, { kind: "version", message: `Version ${now.version} of this discussion has been saved.` });
          }
        });
      }),
    );
    entry.watchers.push(...(await this.watchLinkedPages(key, ref)));
    return entry;
  }

  // The pages the discussion links to, which other sessions may be changing
  // while it is open. Each is fingerprinted, so a page written again without
  // a change says nothing.
  private async watchLinkedPages(key: string, ref: DiscussionRef): Promise<FSWatcher[]> {
    const { pageMd } = await this.store.read(ref);
    const linked = new Map<string, { name: string; hash: string }>();
    for (const name of pageLinks(parsePage(pageMd))) {
      const path = await pageFile(name).catch(() => undefined);
      if (!path) continue;
      linked.set(basename(path), { name, hash: fingerprint(await readFile(path, "utf8")) });
    }
    if (linked.size === 0) return [];
    const pages = kbPages();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    return [
      watch(pages, (_event, file) => {
        const page = file ? linked.get(file) : undefined;
        if (!file || !page) return;
        clearTimeout(timers.get(file));
        timers.set(
          file,
          setTimeout(async () => {
            const text = await readFile(`${pages}/${file}`, "utf8").catch(() => undefined);
            if (text === undefined || fingerprint(text) === page.hash) return;
            page.hash = fingerprint(text);
            this.notify(key, { kind: "linked", page: page.name, message: `${page.name} has changed.` });
          }, SETTLE),
        );
      }),
    ];
  }

  private notify(key: string, change: Change): number {
    const entry = this.watched.get(key);
    if (!entry) return 0;
    for (const page of entry.pages) page.write(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
    return entry.pages.size;
  }

  private unsubscribe(key: string, response: ServerResponse): void {
    const entry = this.watched.get(key);
    if (!entry) return;
    entry.pages.delete(response);
    if (entry.pages.size > 0) return;
    clearTimeout(entry.timer);
    for (const watcher of entry.watchers) watcher.close();
    this.watched.delete(key);
  }
}

function keyOf(ref: DiscussionRef): string {
  return `${ref.source}/${ref.startedAt}`;
}

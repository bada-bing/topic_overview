// The routes of a discussion on the source itself, addressed by its topic's
// key: `/api/topics/<key>` is the view, rendered from the page as it stands in
// the discussion's worktree; `…/integrations` their states; `…/events` the
// stream that tells the open page its source changed; `…/assets/<file>` a
// file of the knowledge base's assets/, such as an image, as the branch has it.

import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { basename, dirname, extname, join } from "node:path";

import { type DiscussionView, StoreError, type Topic, Topics, numberByPlace, parsePage, sourceProblems } from "@topic-overview/core";

import { integrationStates } from "./integrations.ts";

export const TOPIC = /^\/api\/topics\/([^/]+)(?:\/(integrations|events|assets)(?:\/([^/]+))?)?$/;

const HEARTBEAT = 20_000;
// Editors and git write a file in several steps; one notice follows the last.
const SETTLE = 300;

let topics: Topics | undefined;
// The knowledge base is read from .env when the first topic is asked for.
function store(): Topics {
  topics ??= new Topics();
  return topics;
}

// An asset is served as its kind; anything else as plain bytes.
const ASSET_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function handleTopic(response: ServerResponse, key: string, verb: string | undefined, file?: string): Promise<void> {
  if (verb === "events") return subscribe(response, key);
  if (verb === "assets") return sendAsset(response, key, file);
  if (verb === "integrations") {
    const topic = await store().read(key);
    return send(response, 200, await integrationStates(topic.integrations));
  }
  const { topic, text } = await store().source(key);
  send(response, 200, view(topic, text));
}

// The view the page already knows, with the page converted in memory: the
// blocks are numbered for the page's own addressing, and nothing is written
// back to the source. What cannot be rendered is reported with the reason,
// and the rest is rendered.
function view(topic: Topic, text: string): DiscussionView {
  const page = parsePage(text);
  numberByPlace(page.blocks);
  return {
    ref: { source: topic.key, startedAt: "" },
    discussion: {
      source: topic.page,
      opened: topic.opened,
      closed: null,
      version: 1,
      sessions: topic.session ? [topic.session] : [],
      integrations: topic.integrations,
      annotations: [],
    },
    page,
    attachments: [],
    earlier: [],
    branch: topic.branch,
    problems: sourceProblems(page),
  };
}

// The page is told when its source changes in the worktree, and reloads.
async function subscribe(response: ServerResponse, key: string): Promise<void> {
  const topic = await store().read(key);
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  response.write(": connected\n\n");
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The folder is watched rather than the file, since git replaces a file it
  // checks out or merges, and a watcher on the file would end with it.
  const file = join(store().worktree(key), topic.page);
  const watcher = watch(dirname(file), (_event, name) => {
    if (name !== basename(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const change = { kind: "version", message: "The source changed." };
      response.write(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
    }, SETTLE);
  });
  const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), HEARTBEAT);
  response.on("close", () => {
    clearTimeout(timer);
    clearInterval(heartbeat);
    watcher.close();
  });
}

// A file name only, never a path, so nothing outside assets/ is reached.
async function sendAsset(response: ServerResponse, key: string, file: string | undefined): Promise<void> {
  if (!file || file !== basename(file) || file.startsWith(".")) throw new StoreError("not an asset");
  const content = await readFile(join(store().worktree(key), "assets", file));
  response.writeHead(200, { "content-type": ASSET_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
  response.end(content);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

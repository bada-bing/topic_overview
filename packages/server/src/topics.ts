// The routes of a discussion on the source itself, addressed by its topic's
// key: `/api/topics/<key>` is the view, rendered from the page as it stands in
// the discussion's worktree; `…/integrations` their states; `…/events` the
// stream that tells the open page its source changed.

import { watch } from "node:fs";
import type { ServerResponse } from "node:http";
import { basename, dirname, join } from "node:path";

import { type DiscussionView, type Topic, Topics, convertLogseq, parsePage, sourceProblems } from "@topic-overview/core";

import { integrationStates } from "./integrations.ts";

export const TOPIC = /^\/api\/topics\/([^/]+)(?:\/(integrations|events))?$/;

const HEARTBEAT = 20_000;
// Editors and git write a file in several steps; one notice follows the last.
const SETTLE = 300;

let topics: Topics | undefined;
// The knowledge base is read from .env when the first topic is asked for.
function store(): Topics {
  topics ??= new Topics();
  return topics;
}

export async function handleTopic(response: ServerResponse, key: string, verb: string | undefined): Promise<void> {
  if (verb === "events") return subscribe(response, key);
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
  const page = parsePage(convertLogseq(text));
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

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

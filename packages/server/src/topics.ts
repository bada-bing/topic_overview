// The routes of a discussion on the source itself, addressed by its topic's
// key: `/api/topics/<key>` is the view, rendered from the page as it stands in
// the discussion's worktree; `…/integrations` their states; `…/events` the
// stream that tells the open page its source changed and what its agent is
// doing; `…/assets/<file>` a file of the knowledge base's assets/, such as an
// image, as the branch has it; `…/blocks/<id>` a block's own text, read with
// GET and saved with PUT from the Edit button.

import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, extname, join } from "node:path";

import { type DiscussionView, StoreError, type Topic, Topics, numberByPlace, parsePage, sourceProblems } from "@topic-overview/core";

import { integrationStates } from "./integrations.ts";

export const TOPIC = /^\/api\/topics\/([^/]+)(?:\/(integrations|events|assets|blocks)(?:\/([^/]+))?)?$/;

const HEARTBEAT = 20_000;
// Editors and git write a file in several steps; one notice follows the last.
const SETTLE = 300;
const AGENT_INTERVAL = 1_000;

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

export async function handleTopic(
  request: IncomingMessage,
  response: ServerResponse,
  key: string,
  verb: string | undefined,
  file?: string,
): Promise<void> {
  if (verb === "blocks" && file) {
    if (request.method === "PUT") {
      const { text } = await readJson<{ text?: unknown }>(request);
      if (typeof text !== "string" || text.trim() === "") throw new StoreError("a block needs text");
      return send(response, 200, await store().editOwnText(key, file, text));
    }
    return send(response, 200, { text: await store().ownText(key, file) });
  }
  if (request.method !== "GET") return send(response, 405, { error: "method not allowed" });
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
  // What the agent is doing, told when it changes, so the page can let me
  // edit only while the agent is not working.
  let agent: string | undefined;
  const askAgent = async () => {
    const state = await store().agentState(key);
    if (state === agent) return;
    agent = state;
    response.write(`event: change\ndata: ${JSON.stringify({ kind: "agent", state })}\n\n`);
  };
  void askAgent();
  const agentPoll = setInterval(() => void askAgent(), AGENT_INTERVAL);
  const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), HEARTBEAT);
  response.on("close", () => {
    clearTimeout(timer);
    clearInterval(heartbeat);
    clearInterval(agentPoll);
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

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new StoreError("the request body is not JSON");
  }
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

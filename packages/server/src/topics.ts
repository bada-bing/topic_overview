// The routes of a discussion on the source itself, addressed by its topic's
// key: `/api/topics/<key>` is the view, rendered from the page as it stands in
// the discussion's worktree; `…/integrations` their states; `…/events` the
// stream that tells the open page its source changed and what its agent is
// doing; `…/assets/<file>` a file of the knowledge base's assets/, such as an
// image, as the branch has it; `…/blocks/<id>` a block's own text, read with
// GET and saved with PUT from the Edit button; `…/marks/<id>` deleted when I
// confirm I saw what the agent changed in a block; `…/agent` posted to bring
// the agent's tmux window up in the terminal.

import { watch as watchFiles } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, extname, join } from "node:path";

import { type DiscussionView, StoreError, type Topic, Topics, numberByPlace, pageLinks, parsePage, sourceProblems } from "@topic-overview/core";

import { integrationStates } from "./integrations.ts";

export const TOPIC = /^\/api\/topics\/([^/]+)(?:\/(integrations|events|assets|blocks|marks|agent)(?:\/([^/]+))?)?$/;

// A heartbeat the page can see, so it can tell a stream that died quietly.
const HEARTBEAT = 10_000;
// Editors and git write a file in several steps; one notice follows the last.
const SETTLE = 300;
const AGENT_INTERVAL = 1_000;
const MAIN_INTERVAL = 2_000;

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
  if (verb === "marks" && file && request.method === "DELETE") return send(response, 200, await store().clearMark(key, file));
  if (verb === "agent" && request.method === "POST") {
    await store().focusAgent(key);
    return send(response, 200, {});
  }
  if (request.method !== "GET") return send(response, 405, { error: "method not allowed" });
  if (verb === "events") return subscribe(response, key);
  if (verb === "assets") return sendAsset(response, key, file);
  if (verb === "integrations") {
    const topic = await store().read(key);
    return send(response, 200, await integrationStates(topic.integrations));
  }
  const { topic, text } = await store().source(key);
  send(response, 200, { ...view(topic, text), conflict: await store().conflict(key) });
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
    marks: topic.marks ?? [],
    problems: sourceProblems(page),
  };
}

// What an open discussion is watched for: its source changing in the
// worktree, its agent's state, and what is new on main. One watcher belongs
// to the discussion, not to a page: it starts with the first page open on it
// and stops with the last, and what it finds goes to every page open on it,
// so no page misses what another one's check found.
interface Watch {
  pages: Set<ServerResponse>;
  agent?: string;
  agentName?: string;
  conflict: string;
  stop: () => void;
}

const watches = new Map<string, Watch>();

function tell(watch: Watch, change: unknown): void {
  for (const page of watch.pages) page.write(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
}

async function subscribe(response: ServerResponse, key: string): Promise<void> {
  // A discussion that is gone is refused before the stream begins.
  await store().read(key);
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  response.write(": connected\n\n");
  let watch = watches.get(key);
  if (!watch) {
    watch = { pages: new Set(), conflict: "", stop: () => {} };
    watches.set(key, watch);
    await startWatch(key, watch);
  }
  watch.pages.add(response);
  // A page that joins learns what the others know already.
  if (watch.agent) response.write(`event: change\ndata: ${JSON.stringify({ kind: "agent", state: watch.agent, name: watch.agentName })}\n\n`);
  if (watch.conflict) response.write(`event: change\ndata: ${JSON.stringify({ kind: "conflict", files: watch.conflict.split("\n") })}\n\n`);
  const heartbeat = setInterval(() => response.write("event: heartbeat\ndata: \n\n"), HEARTBEAT);
  const watched = watch;
  response.on("close", () => {
    clearInterval(heartbeat);
    watched.pages.delete(response);
    if (watched.pages.size > 0) return;
    watched.stop();
    watches.delete(key);
  });
}

async function startWatch(key: string, watch: Watch): Promise<void> {
  const topic = await store().read(key);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The folder is watched rather than the file, since git replaces a file it
  // checks out or merges, and a watcher on the file would end with it.
  const file = join(store().worktree(key), topic.page);
  const watcher = watchFiles(dirname(file), (_event, name) => {
    if (name !== basename(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => tell(watch, { kind: "version", message: "The source changed." }), SETTLE);
  });
  // What the agent is doing, told when it changes, so the pages let me edit
  // only while the agent is not working.
  const askAgent = async () => {
    const { state, name } = await store().agent(key);
    if (state === watch.agent && name === watch.agentName) return;
    watch.agent = state;
    watch.agentName = name;
    tell(watch, { kind: "agent", state, name });
  };
  // What is new on main is merged as it lands, while the agent is not
  // working, so a merge never lands in the middle of its turn. A merge that
  // changed this page or a page it links to is told; a conflict is told
  // until it is resolved in the terminal.
  let taking = false;
  const merge = async () => {
    if (watch.agent === "busy" || taking) return;
    taking = true;
    try {
      const result = await store().mergeMain(key);
      const now = "conflict" in result ? result.conflict.join("\n") : "";
      if (now !== watch.conflict) {
        watch.conflict = now;
        tell(watch, { kind: "conflict", files: now ? now.split("\n") : [] });
      }
      if ("files" in result && result.files.length > 0) {
        const related = await relatedFiles(key, result.files);
        if (related.length > 0) tell(watch, { kind: "info", message: "Updated from main:", files: related });
      }
    } finally {
      taking = false;
    }
  };
  // A check that fails is left to the next one, unless the discussion is
  // gone, closed or discarded: then the watch ends, and with it the pages'
  // streams. Nothing a check runs into may stop the server.
  const check = (run: () => Promise<void>) => () =>
    void run().catch(async () => {
      if (await store().read(key).then(() => true, () => false)) return;
      watch.stop();
      watches.delete(key);
      for (const page of watch.pages) page.end();
    });
  await askAgent().catch(() => {});
  check(merge)();
  const agentPoll = setInterval(check(askAgent), AGENT_INTERVAL);
  const mainPoll = setInterval(check(merge), MAIN_INTERVAL);
  watch.stop = () => {
    clearTimeout(timer);
    clearInterval(agentPoll);
    clearInterval(mainPoll);
    watcher.close();
  };
}

// A file name only, never a path, so nothing outside assets/ is reached.
async function sendAsset(response: ServerResponse, key: string, file: string | undefined): Promise<void> {
  if (!file || file !== basename(file) || file.startsWith(".")) throw new StoreError("not an asset");
  const content = await readFile(join(store().worktree(key), "assets", file));
  response.writeHead(200, { "content-type": ASSET_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
  response.end(content);
}

// The files a merge changed that matter to this page: the page itself, and
// the pages it links to, named as the page names them.
async function relatedFiles(key: string, files: string[]): Promise<string[]> {
  const { topic, text } = await store().source(key);
  const named = new Map<string, string>([[topic.page.toLowerCase(), "this page"]]);
  for (const link of pageLinks(parsePage(text))) named.set(`pages/${link.replaceAll("/", "%2F")}.md`.toLowerCase(), `[[${link}]]`);
  return files.flatMap((file) => named.get(file.toLowerCase()) ?? []);
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

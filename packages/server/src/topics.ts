// The routes of a discussion on the source itself, addressed by its topic's
// key: `/api/topics/<key>` is the view, rendered from the page as it stands in
// the discussion's worktree; `…/integrations` their states; `…/events` the
// stream that tells the open page its source changed and what its agent is
// doing; `…/assets/<file>` a file of the knowledge base's assets/, such as an
// image or a markdown document, as the branch has it; `…/blocks/<id>` a block's own text, read with
// GET and saved with PUT from the Edit button; `…/marks/<id>` deleted when I
// confirm I saw what the agent changed in a block; `…/questions` posted to ask
// the agent about a block, `…/questions/<id>` posted to ask further and
// deleted when I dismiss it; `…/agent` posted to bring the agent's tmux window
// up in the terminal; `…/worktree` posted to bring up a window working in the
// discussion's worktree; `…/integrations/<id>` posted to bring a local
// process's window or a page's tab up, to open a page's tab again, or to
// start or restart a process.

import { watch as watchFiles } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, extname, join } from "node:path";

import {
  type DiscussionView,
  type Integration,
  StoreError,
  type Topic,
  Topics,
  blocksElsewhere,
  linkedMergeRequests,
  numberByPlace,
  pageLinks,
  parsePage,
  references,
  sourceProblems,
  walk,
} from "@topic-overview/core";

import { focusTab, openTab } from "./browser.ts";
import { INTERVALS, integrationState, integrationStates } from "./integrations.ts";

export const TOPIC = /^\/api\/topics\/([^/]+)(?:\/(integrations|events|assets|blocks|marks|questions|agent|worktree)(?:\/([^/]+))?)?$/;

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
  ".md": "text/markdown; charset=utf-8",
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
  if (verb === "questions" && !file && request.method === "POST") {
    const { block, prompt } = await readJson<{ block?: unknown; prompt?: unknown }>(request);
    if (typeof block !== "string" || typeof prompt !== "string") throw new StoreError("a question needs a block and a prompt");
    return send(response, 200, await store().ask(key, block, prompt));
  }
  if (verb === "questions" && file && request.method === "POST") {
    const { prompt } = await readJson<{ prompt?: unknown }>(request);
    if (typeof prompt !== "string") throw new StoreError("a follow-up needs a prompt");
    return send(response, 200, await store().followUp(key, file, prompt));
  }
  if (verb === "questions" && file && request.method === "DELETE") return send(response, 200, await store().dismiss(key, file));
  if (verb === "agent" && request.method === "POST") {
    await store().focusAgent(key);
    return send(response, 200, {});
  }
  if (verb === "integrations" && file && request.method === "POST") {
    const { action } = await readJson<{ action?: unknown }>(request);
    const integration = (await store().read(key)).integrations.find((known) => known.id === file);
    if (integration?.kind === "browser" && action === "open") {
      await store().setTab(key, file, await openTab(integration.reference));
      return send(response, 200, {});
    }
    if (action === "focus") {
      if (integration?.kind === "browser") await focusTab(integration.tab?.id ?? "");
      else await store().focusProcess(key, file);
      return send(response, 200, {});
    }
    if (action === "start") return send(response, 200, { said: await store().startProcess(key, file) });
    throw new StoreError("an integration is focused, opened or started");
  }
  if (verb === "worktree" && request.method === "POST") {
    await store().focusWorktree(key);
    return send(response, 200, {});
  }
  if (request.method !== "GET") return send(response, 405, { error: "method not allowed" });
  if (verb === "events") return subscribe(response, key);
  if (verb === "assets") return sendAsset(response, key, file);
  if (verb === "integrations") {
    const { topic, text } = await store().source(key);
    return send(response, 200, await integrationStates(integrationsOf(topic, text)));
  }
  const { topic, text } = await store().source(key);
  send(response, 200, { ...(await view(topic, text)), conflict: await store().conflict(key) });
}

// What a discussion depends on outside its source: the merge requests its
// page lists under Links, then the integrations the agent added.
function integrationsOf(topic: Topic, text: string): Integration[] {
  return [...linkedMergeRequests(parsePage(text)), ...topic.integrations];
}

// The view the page already knows, with the page converted in memory: the
// blocks are numbered for the page's own addressing, and nothing is written
// back to the source. What cannot be rendered is reported with the reason,
// and the rest is rendered.
async function view(topic: Topic, text: string): Promise<DiscussionView> {
  const page = parsePage(text);
  numberByPlace(page.blocks);
  // A reference to a block not on the page is looked for on the knowledge
  // base's other pages, as the discussion's branch has them.
  const onPage = new Set([...walk(page.blocks)].map((block) => block.id));
  const offPage = [...walk(page.blocks)].flatMap((block) => references(block.text)).filter((target) => !onPage.has(target));
  const elsewhere = await blocksElsewhere(store().worktree(topic.key), offPage);
  return {
    ref: { source: topic.key, startedAt: "" },
    discussion: {
      source: topic.page,
      opened: topic.opened,
      closed: null,
      version: 1,
      sessions: topic.session ? [topic.session] : [],
      integrations: integrationsOf(topic, text),
      annotations: [],
    },
    page,
    attachments: [],
    earlier: [],
    branch: topic.branch,
    worktree: store().worktree(topic.key),
    marks: topic.marks ?? [],
    questions: topic.questions ?? [],
    problems: sourceProblems(page, new Set(Object.keys(elsewhere))),
    elsewhere,
  };
}

// What an open discussion is watched for: its source changing in the
// worktree, its state changing, such as by an answer, its agent's state, and
// what is new on main. One watcher belongs
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
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => tell(watch, { kind: "version", message: "The source changed." }), SETTLE);
  };
  const watcher = watchFiles(dirname(file), (_event, name) => {
    if (name === basename(file)) changed();
  });
  const state = `${key}.json`;
  const stateWatcher = watchFiles(store().root, (_event, name) => {
    if (name === state) changed();
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
  // The integrations are read anew on every round, so a merge request added
  // to Links, or one the agent adds, is watched from then on. Each kind is
  // asked as often as INTERVALS says, and a change of state goes to the
  // pages' Integrations widget.
  const last = new Map<string, { state: string; detail?: string; name?: string; at: number }>();
  // A page with no tab yet is opened once, the first time it is watched;
  // after that, only the Open button opens it again.
  const opened = new Set<string>();
  const integrations = async () => {
    const { topic, text } = await store().source(key);
    const now = Date.now();
    for (const integration of integrationsOf(topic, text)) {
      if (integration.kind === "browser" && !integration.tab && !opened.has(integration.id)) {
        opened.add(integration.id);
        integration.tab = await openTab(integration.reference);
        await store().setTab(key, integration.id, integration.tab);
      }
      const before = last.get(integration.id);
      if (before && now - before.at < INTERVALS[integration.kind]) continue;
      const state = await integrationState(integration);
      last.set(integration.id, { state: state.state, detail: state.detail, name: state.name, at: now });
      if (!before || before.state !== state.state || before.detail !== state.detail || before.name !== state.name) {
        tell(watch, { kind: "integration", state });
      }
    }
  };
  check(integrations)();
  const integrationPoll = setInterval(check(integrations), INTERVALS.local);
  watch.stop = () => {
    clearTimeout(timer);
    clearInterval(agentPoll);
    clearInterval(mainPoll);
    clearInterval(integrationPoll);
    watcher.close();
    stateWatcher.close();
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

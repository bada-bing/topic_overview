import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname } from "node:path";

import { parsePage } from "@topic-overview/core";
import { Store, StoreError, openOnLogseqPage } from "@topic-overview/core";

import { Changes } from "./changes.ts";
import { GitlabError, GitlabUnreachable, mergeRequestState } from "./gitlab.ts";
import { integrationStates } from "./integrations.ts";

import { KbError, previewKbPage, readKbPage } from "./kb.ts";
import { TOPIC, handleTopic } from "./topics.ts";

const HOST = "127.0.0.1";
const PORT = Number(process.env.TOPIC_OVERVIEW_PORT ?? 4310);

const store = new Store();
const changes = new Changes(store);

// An attachment's file is served as its kind; diagrams and tables are text.
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const DISCUSSION = /^\/api\/discussions\/([^/]+)\/([^/]+)$/;
const EVENTS = /^\/api\/discussions\/([^/]+)\/([^/]+)\/(events|changed|refresh|integrations)$/;
const ATTACHMENT = /^\/api\/discussions\/([^/]+)\/([^/]+)\/attachments\/([^/]+)$/;
const COMMENTS = /^\/api\/discussions\/([^/]+)\/([^/]+)\/comments(?:\/([^/]+))?$/;
const PREVIEW = /^\/api\/preview\/(.+)$/;
const SOURCE = /^\/api\/source\/(.+)$/;

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${HOST}`);
  const topic = TOPIC.exec(url.pathname);
  if (topic) {
    return handleTopic(request, response, decodeURIComponent(topic[1]), topic[2], topic[3] && decodeURIComponent(topic[3]));
  }
  const discussion = DISCUSSION.exec(url.pathname);
  if (request.method === "GET" && discussion) {
    const ref = { source: decodeURIComponent(discussion[1]), startedAt: decodeURIComponent(discussion[2]) };
    const contents = await store.read(ref);
    const earlier = [];
    for (const other of await store.discussionsOf(ref.source)) {
      if (other.startedAt === ref.startedAt) continue;
      const { discussion } = await store.read(other);
      earlier.push({
        startedAt: other.startedAt,
        version: discussion.version,
        closed: discussion.closed,
        resolution: discussion.resolution,
      });
    }
    return send(response, 200, {
      ref,
      discussion: contents.discussion,
      page: parsePage(contents.pageMd),
      attachments: contents.attachments,
      earlier,
    });
  }
  const action = EVENTS.exec(url.pathname);
  if (action) return handleAction(request, response, action);
  const attachment = ATTACHMENT.exec(url.pathname);
  if (request.method === "GET" && attachment) {
    const ref = { source: decodeURIComponent(attachment[1]), startedAt: decodeURIComponent(attachment[2]) };
    const path = await store.attachmentFile(ref, decodeURIComponent(attachment[3]));
    response.writeHead(200, { "content-type": CONTENT_TYPES[extname(path).toLowerCase()] ?? "text/plain; charset=utf-8" });
    response.end(await readFile(path));
    return;
  }
  const comments = COMMENTS.exec(url.pathname);
  if (comments) return handleComments(request, response, comments);
  if (request.method === "GET" && url.pathname === "/api/merge-request") {
    return send(response, 200, await mergeRequestState(url.searchParams.get("url") ?? ""));
  }
  const preview = PREVIEW.exec(url.pathname);
  if (request.method === "GET" && preview) return send(response, 200, await previewKbPage(decodeURIComponent(preview[1])));
  const source = SOURCE.exec(url.pathname);
  if (request.method === "GET" && source) return send(response, 200, await readKbPage(decodeURIComponent(source[1])));
  send(response, 404, { error: "not found" });
}

// GET …/events is the stream of changes to an open page. POST …/changed
// announces a change from outside. POST …/refresh refreshes the discussion
// from its source: it copies the source again as it is now, into a discussion
// of its own, and closes the old one with its comments.
async function handleAction(request: IncomingMessage, response: ServerResponse, match: RegExpExecArray): Promise<void> {
  const ref = { source: decodeURIComponent(match[1]), startedAt: decodeURIComponent(match[2]) };
  const verb = match[3];
  if (verb === "events" && request.method === "GET") return changes.subscribe(ref, response);
  if (verb === "integrations" && request.method === "GET") {
    const { discussion } = await store.read(ref);
    return send(response, 200, await integrationStates(discussion.integrations ?? []));
  }
  if (verb === "changed" && request.method === "POST") {
    const { message } = await readJson<{ message?: string }>(request).catch(() => ({ message: undefined }));
    const pages = changes.announce(ref, message?.trim() || "Something this discussion depends on has changed.");
    return send(response, 200, { pages });
  }
  if (verb === "refresh" && request.method === "POST") {
    const { discussion } = await store.read(ref);
    const opened = await openOnLogseqPage(
      store,
      ref.source,
      discussion.source,
      undefined,
      discussion.sessions,
      "source-changed",
      discussion.integrations ?? [],
    );
    return send(response, 200, { ref: opened });
  }
  send(response, 405, { error: "method not allowed" });
}

// POST …/comments adds a comment; PATCH and DELETE …/comments/<id> edit and
// delete one. Each answers with the discussion's annotations as they now are.
async function handleComments(request: IncomingMessage, response: ServerResponse, match: RegExpExecArray): Promise<void> {
  const ref = { source: decodeURIComponent(match[1]), startedAt: decodeURIComponent(match[2]) };
  const id = match[3] ? decodeURIComponent(match[3]) : undefined;
  if (request.method === "POST" && !id) {
    const { target, body } = await readJson<{ target: string; body: string }>(request);
    await store.addComment(ref, target, requireText(body));
  } else if (request.method === "PATCH" && id) {
    const { body } = await readJson<{ body: string }>(request);
    await store.editComment(ref, id, requireText(body));
  } else if (request.method === "DELETE" && id) {
    await store.deleteComment(ref, id);
  } else {
    return send(response, 405, { error: "method not allowed" });
  }
  const { discussion } = await store.read(ref);
  send(response, 200, discussion.annotations);
}

function requireText(body: unknown): string {
  if (typeof body !== "string" || body.trim() === "") throw new StoreError("a comment needs text");
  return body.trim();
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

const server = createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    if (error instanceof StoreError) return send(response, 400, { error: error.message });
    if (error instanceof KbError) return send(response, 404, { error: error.message });
    if (error instanceof GitlabError) return send(response, 404, { error: error.message });
    if (error instanceof GitlabUnreachable) return send(response, 502, { error: error.message });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return send(response, 404, { error: "no such discussion" });
    console.error(error);
    send(response, 500, { error: "the server failed" });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`topic_overview server on http://${HOST}:${PORT}`);
});

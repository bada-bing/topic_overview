import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { parsePage } from "@topic-overview/core";
import { Store, StoreError } from "@topic-overview/core";

import { KbError, previewKbPage, readKbPage } from "./kb.ts";

const HOST = "127.0.0.1";
const PORT = Number(process.env.TOPIC_OVERVIEW_PORT ?? 4310);

const store = new Store();

const DISCUSSION = /^\/api\/discussions\/([^/]+)\/([^/]+)$/;
const COMMENTS = /^\/api\/discussions\/([^/]+)\/([^/]+)\/comments(?:\/([^/]+))?$/;
const PREVIEW = /^\/api\/preview\/(.+)$/;
const SOURCE = /^\/api\/source\/(.+)$/;

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${HOST}`);
  const discussion = DISCUSSION.exec(url.pathname);
  if (request.method === "GET" && discussion) {
    const ref = { source: decodeURIComponent(discussion[1]), startedAt: decodeURIComponent(discussion[2]) };
    const contents = await store.read(ref);
    return send(response, 200, { ref, discussion: contents.discussion, page: parsePage(contents.pageMd) });
  }
  const comments = COMMENTS.exec(url.pathname);
  if (comments) return handleComments(request, response, comments);
  const preview = PREVIEW.exec(url.pathname);
  if (request.method === "GET" && preview) return send(response, 200, await previewKbPage(decodeURIComponent(preview[1])));
  const source = SOURCE.exec(url.pathname);
  if (request.method === "GET" && source) return send(response, 200, await readKbPage(decodeURIComponent(source[1])));
  send(response, 404, { error: "not found" });
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return send(response, 404, { error: "no such discussion" });
    console.error(error);
    send(response, 500, { error: "the server failed" });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`topic_overview server on http://${HOST}:${PORT}`);
});

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { StoreError } from "@topic-overview/core";

import { GitlabError, GitlabUnreachable, mergeRequestState } from "./gitlab.ts";
import { appIcon, iconOf } from "./icons.ts";
import { KbError, previewKbPage, readKbPage } from "./kb.ts";
import { TOPIC, handleTopic } from "./topics.ts";

const HOST = "127.0.0.1";
const PORT = Number(process.env.TOPIC_OVERVIEW_PORT ?? 4310);

const PREVIEW = /^\/api\/preview\/(.+)$/;
const SOURCE = /^\/api\/source\/(.+)$/;

// The server listens only on this machine, but any page open in the browser
// can send it a request, so whatever changes something is accepted only from
// a page served here. A request with no origin comes from no page, such as
// curl.
function fromHere(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (request.method === "GET" || !origin) return true;
  return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${HOST}`);
  if (!fromHere(request)) return send(response, 403, { error: "only a page served here may change anything" });
  const topic = TOPIC.exec(url.pathname);
  if (topic) {
    return handleTopic(request, response, decodeURIComponent(topic[1]), topic[2], topic[3] && decodeURIComponent(topic[3]));
  }
  if (request.method === "GET" && url.pathname === "/api/icon") {
    const app = url.searchParams.get("app");
    const icon = app ? await appIcon(app) : await iconOf(url.searchParams.get("origin") ?? "");
    // A site's icon is kept for a day; an app's is asked again each time,
    // since another app may be configured behind the same address.
    response.writeHead(200, { "content-type": icon.type, "cache-control": app ? "no-cache" : "max-age=86400" });
    response.end(icon.body);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/merge-request") {
    return send(response, 200, await mergeRequestState(url.searchParams.get("url") ?? ""));
  }
  const preview = PREVIEW.exec(url.pathname);
  if (request.method === "GET" && preview) return send(response, 200, await previewKbPage(decodeURIComponent(preview[1])));
  const source = SOURCE.exec(url.pathname);
  if (request.method === "GET" && source) return send(response, 200, await readKbPage(decodeURIComponent(source[1])));
  send(response, 404, { error: "not found" });
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    // A response already under way, such as a stream, can only be ended.
    if (response.headersSent) {
      console.error(error);
      response.end();
      return;
    }
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

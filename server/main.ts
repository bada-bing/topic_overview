import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { parsePage } from "./page.ts";
import { Store, StoreError } from "./store.ts";

const HOST = "127.0.0.1";
const PORT = 4310;

const store = new Store(process.env.TOPIC_OVERVIEW_DISCUSSIONS);

const DISCUSSION = /^\/api\/discussions\/([^/]+)\/([^/]+)$/;

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${HOST}`);
  const discussion = DISCUSSION.exec(url.pathname);
  if (request.method === "GET" && discussion) {
    const ref = { source: decodeURIComponent(discussion[1]), startedAt: decodeURIComponent(discussion[2]) };
    const contents = await store.read(ref);
    return send(response, 200, { ref, discussion: contents.discussion, page: parsePage(contents.pageMd) });
  }
  send(response, 404, { error: "not found" });
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    if (error instanceof StoreError) return send(response, 400, { error: error.message });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return send(response, 404, { error: "no such discussion" });
    console.error(error);
    send(response, 500, { error: "the server failed" });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`topic_overview server on http://${HOST}:${PORT}`);
});

import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 4310;

const server = createServer((_request, response) => {
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`topic_overview server on http://${HOST}:${PORT}`);
});

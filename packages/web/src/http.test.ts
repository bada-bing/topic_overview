import assert from "node:assert/strict";
import { test } from "node:test";

import { readAnswer } from "./http.ts";

test("an answer without a body says the server is not reachable", async () => {
  await assert.rejects(readAnswer(new Response("", { status: 502 })), /not reachable/);
});

test("an error the server sends is passed on", async () => {
  await assert.rejects(readAnswer(new Response('{"error":"there is no page x"}', { status: 404 })), /no page x/);
});

test("a good answer is read", async () => {
  assert.deepEqual(await readAnswer(new Response('{"ok":1}')), { ok: 1 });
});

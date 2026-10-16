import assert from "node:assert/strict";
import { test } from "node:test";

import { forkArguments, parseForkOutput } from "./fork.ts";

test("a fork copies the session it starts from, and a follow-up continues the fork", () => {
  const first = forkArguments({ from: "main", session: "new", prompt: "Which merge requests are open?" });
  assert.ok(first.includes("--fork-session"));
  assert.equal(first[first.indexOf("--session-id") + 1], "new");
  assert.equal(first[first.indexOf("--resume") + 1], "main");
  assert.ok(first[1].endsWith("Which merge requests are open?"));
  const again = forkArguments({ from: "fork", resume: true, prompt: "And which touch the store?", model: "sonnet" });
  assert.ok(!again.includes("--fork-session"));
  assert.deepEqual(again.slice(-2), ["--model", "sonnet"]);
});

test("the fork may only read", () => {
  const args = forkArguments({ from: "main", prompt: "x" });
  assert.equal(args[args.indexOf("--allowedTools") + 1], "Read,Glob,Grep");
  assert.ok(args[args.indexOf("--disallowedTools") + 1].split(",").includes("Bash"));
});

test("the answer is read off the JSON output", () => {
  assert.deepEqual(parseForkOutput('{"session_id":"s1","result":"three","is_error":false,"duration_ms":1500}'), {
    session: "s1",
    answer: "three",
    failed: false,
    duration: 1500,
  });
  assert.throws(() => parseForkOutput("not json"), /no JSON/);
});

test("a session's directory is read off its transcript", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { sessionDirectory } = await import("./fork.ts");
  const folder = await mkdtemp(join(tmpdir(), "transcript-"));
  const file = join(folder, "s.jsonl");
  await writeFile(file, `${JSON.stringify({ type: "mode" })}\n${JSON.stringify({ type: "user", cwd: "/Users/me/src/garden", message: {} })}\n`);
  assert.equal(await sessionDirectory(file), "/Users/me/src/garden");
  assert.equal(await sessionDirectory(join(folder, "none.jsonl")), undefined);
  await rm(folder, { recursive: true, force: true });
});

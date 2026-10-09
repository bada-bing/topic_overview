import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { claudeSession } from "./sessions.ts";

test("a session's transcript is found by its id, wherever the command runs", async () => {
  const projects = await mkdtemp(join(tmpdir(), "projects-"));
  await mkdir(join(projects, "-Users-me-src-garden"));
  await writeFile(join(projects, "-Users-me-src-garden", "abc.jsonl"), "");
  assert.equal(claudeSession("abc", "/somewhere/else", projects).transcript, join(projects, "-Users-me-src-garden", "abc.jsonl"));
  assert.equal(claudeSession("new", "/Users/me/src/garden", projects).transcript, join(projects, "-Users-me-src-garden", "new.jsonl"));
  await rm(projects, { recursive: true, force: true });
});

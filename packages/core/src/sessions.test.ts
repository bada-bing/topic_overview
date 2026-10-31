import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { claudeSession, firstPrompt, repositoryPath, sessionsStore, sourceRepositories, transcriptFacts } from "./sessions.ts";

test("a session's transcript is found by its id, wherever the command runs", async () => {
  const projects = await mkdtemp(join(tmpdir(), "projects-"));
  await mkdir(join(projects, "-Users-me-src-garden"));
  await writeFile(join(projects, "-Users-me-src-garden", "abc.jsonl"), "");
  assert.equal(claudeSession("abc", "/somewhere/else", projects).transcript, join(projects, "-Users-me-src-garden", "abc.jsonl"));
  assert.equal(claudeSession("new", "/Users/me/src/garden", projects).transcript, join(projects, "-Users-me-src-garden", "new.jsonl"));
  await rm(projects, { recursive: true, force: true });
});

test("the session store is where .env points, ~ standing for home", () => {
  const before = process.env.TOPIC_OVERVIEW_SESSIONS;
  delete process.env.TOPIC_OVERVIEW_SESSIONS;
  assert.equal(sessionsStore(), undefined);
  process.env.TOPIC_OVERVIEW_SESSIONS = "~/data/sessions.db";
  assert.equal(sessionsStore(), join(homedir(), "data/sessions.db"));
  process.env.TOPIC_OVERVIEW_SESSIONS = "/var/sessions.db";
  assert.equal(sessionsStore(), "/var/sessions.db");
  if (before === undefined) delete process.env.TOPIC_OVERVIEW_SESSIONS;
  else process.env.TOPIC_OVERVIEW_SESSIONS = before;
});

test("the first prompt is the user's text, tags dropped, on one line, cut to 80", () => {
  assert.equal(firstPrompt('{"type":"user","message":{"role":"user","content":"Read the  brief\\nand do it"}}'), "Read the brief and do it");
  assert.equal(firstPrompt('{"type":"user","message":{"content":[{"type":"text","text":"<command-name>/task</command-name> 10x_06"}]}}'), "/task 10x_06");
  assert.equal(firstPrompt('{"type":"user","isMeta":true,"message":{"content":"hidden"}}'), undefined);
  assert.equal(firstPrompt('{"type":"user","message":{"content":[{"type":"tool_result","content":"x"}]}}'), undefined);
  assert.equal(firstPrompt('{"type":"message","message":{"role":"user","content":[{"type":"text","text":"pi says"}]}}'), "pi says");
  assert.equal(firstPrompt('{"type":"message","message":{"role":"assistant","content":"no"}}'), undefined);
  assert.equal(firstPrompt("not json"), undefined);
  assert.equal(firstPrompt(`{"type":"user","message":{"content":"${"x".repeat(100)}"}}`)?.length, 80);
});

test("a transcript's facts come from its head and its tail, however long its lines", async () => {
  const folder = await mkdtemp(join(tmpdir(), "transcripts-"));
  const path = join(folder, "abc.jsonl");
  const blob = `{"type":"api-request-blob","body":"${"b".repeat(200 * 1024)}"}`;
  const lines = [
    '{"type":"mode","mode":"normal"}',
    '{"type":"file-history-snapshot","snapshot":{"timestamp":"2026-10-30T13:53:59.952Z"}}',
    '{"type":"user","timestamp":"2026-10-30T13:54:00.000Z","message":{"role":"user","content":"first words"}}',
    '{"type":"assistant","timestamp":"2026-10-30T13:54:05.000Z","message":{"content":[{"type":"text","text":"reply"}]}}',
    '{"type":"user","timestamp":"2026-10-31T08:00:00.000Z","message":{"role":"user","content":"later words"}}',
    blob,
    blob,
  ];
  await writeFile(path, lines.join("\n") + "\n");
  assert.deepEqual(await transcriptFacts(path), { started: "2026-10-30T13:53:59.952Z", used: "2026-10-31T08:00:00.000Z", prompt: "first words" });
  await writeFile(path, "");
  assert.deepEqual(await transcriptFacts(path), {});
  await rm(folder, { recursive: true, force: true });
});

test("a page's source repositories are read in both forms, up to a descriptor", () => {
  assert.deepEqual(sourceRepositories("- ## Context\n\t- **Source Repository**: shell-ui\n\t- ### Related Tasks\n"), ["shell-ui"]);
  assert.deepEqual(sourceRepositories("\t- **Source Repository**:\n\t\t- layout-service (branch: feature/x)\n\t\t- ~/Developer/toolbox/scripts\n\t- ### Related Tasks\n\t\t- not-a-repo\n"), ["layout-service", "~/Developer/toolbox/scripts"]);
  assert.deepEqual(sourceRepositories("\t- **Source Repository**:\n\t- ### Related Tasks\n"), []);
  assert.deepEqual(sourceRepositories("- # A freestyle page\n"), []);
});

test("a repository is found as written or under the source root", async () => {
  const src = await mkdtemp(join(tmpdir(), "src-"));
  await mkdir(join(src, "garden"));
  assert.equal(repositoryPath("garden", src), join(src, "garden"));
  assert.equal(repositoryPath(src, src), src);
  assert.equal(repositoryPath("~/", src), homedir());
  assert.equal(repositoryPath("missing", src), undefined);
  await rm(src, { recursive: true, force: true });
});

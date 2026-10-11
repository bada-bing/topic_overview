import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { StoreError } from "./store.ts";
import { Topics } from "./topics.ts";

const PAGE = `- # KEY_1 Grow vegetables
- ## Problem
	- The beds need more sun
`;

const SESSION = { id: "session-a", transcript: "/transcripts/session-a.jsonl" };
const TMUX = { session: "KEY_1", pane: "%7" };

let home: string;
let kb: string;
let topics: Topics;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "topics-"));
  kb = join(home, "KB");
  await mkdir(join(kb, "pages"), { recursive: true });
  await writeFile(join(kb, "pages", "KEY_1-grow_vegetables.md"), PAGE);
  git(kb, "init", "--quiet", "--initial-branch=main");
  git(kb, "add", ".");
  git(kb, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "KEY_1: Open Task");
  topics = new Topics(kb, join(home, "worktrees"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

test("opening a topic checks the knowledge base out on a branch of its own, beside it", async () => {
  const { topic, opened } = await topics.open("KEY_1", SESSION, TMUX);
  assert.equal(opened, true);
  assert.equal(topic.page, join("pages", "KEY_1-grow_vegetables.md"));
  assert.equal(topic.branch, "discussion/KEY_1");
  assert.deepEqual(topic.tmux, TMUX);
  assert.equal(git(join(home, "worktrees", "KEY_1"), "branch", "--show-current").trim(), "discussion/KEY_1");
  assert.equal(git(kb, "branch", "--show-current").trim(), "main");
  assert.equal(git(kb, "status", "--short"), "");
});

test("the state sits beside the worktree, where git does not see it", async () => {
  await topics.open("KEY_1", SESSION, TMUX);
  const state = JSON.parse(await readFile(join(home, "worktrees", "KEY_1.json"), "utf8"));
  assert.equal(state.session.id, "session-a");
  assert.equal(git(join(home, "worktrees", "KEY_1"), "status", "--short"), "");
});

test("the source is read from the worktree", async () => {
  await topics.open("KEY_1");
  const { text } = await topics.source("KEY_1");
  assert.equal(text, PAGE);
});

test("a topic already open is returned as it is", async () => {
  await topics.open("KEY_1", SESSION, TMUX);
  const again = await topics.open("KEY_1", { id: "session-b", transcript: "/b.jsonl" });
  assert.equal(again.opened, false);
  assert.equal(again.topic.session?.id, "session-a");
  assert.deepEqual((await topics.list()).map((topic) => topic.key), ["KEY_1"]);
});

test("a key with no page is refused, and nothing is created", async () => {
  await assert.rejects(topics.open("KEY_2"), StoreError);
  assert.equal(existsSync(join(home, "worktrees", "KEY_2")), false);
});

test("a knowledge base with changes not committed is refused, its journals aside", async () => {
  await mkdir(join(kb, "journals"));
  await writeFile(join(kb, "journals", "2026_10_14.md"), "- written all day\n");
  await writeFile(join(kb, "pages", "wescale%2FWFC.md"), "- a page the task depends on\n");
  await assert.rejects(topics.open("KEY_1"), /wescale%2FWFC\.md/);
  assert.equal(existsSync(join(home, "worktrees", "KEY_1")), false);
  await rm(join(kb, "pages", "wescale%2FWFC.md"));
  assert.equal((await topics.open("KEY_1")).opened, true);
});

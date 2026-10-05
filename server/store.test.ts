import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { parsePage, validatePage } from "./page.ts";
import { Store, StoreError } from "./store.ts";

const PAGE = `---
title-of-source: kept as it is
---
- # Problem
  id:: b1
	- The beds need more sun, see ((b3))
	  id:: b2
- ## Objectives
  id:: b3
	- O1: Grow enough vegetables
	  id:: b4
`;

const SESSION = { id: "session-a", transcript: "/transcripts/session-a.jsonl" };
const OTHER = { id: "session-b", transcript: "/transcripts/session-b.jsonl" };

let root: string;
let store: Store;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "discussions-"));
  store = new Store(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function log(dir: string): string[] {
  return execFileSync("git", ["-C", dir, "log", "--format=%s"], { encoding: "utf8" }).trim().split("\n");
}

function tags(dir: string): string[] {
  return execFileSync("git", ["-C", dir, "tag"], { encoding: "utf8" }).trim().split("\n");
}

test("a page is parsed into nested blocks with ids, headings and frontmatter", () => {
  const page = parsePage(PAGE);
  assert.equal(page.frontmatter, "title-of-source: kept as it is");
  assert.equal(page.blocks.length, 2);
  assert.deepEqual(
    { id: page.blocks[0].id, kind: page.blocks[0].kind, level: page.blocks[0].level, text: page.blocks[0].text },
    { id: "b1", kind: "heading", level: 1, text: "Problem" },
  );
  assert.equal(page.blocks[0].children[0].id, "b2");
  assert.equal(page.blocks[1].children[0].text, "O1: Grow enough vegetables");
  assert.deepEqual(validatePage(page), []);
});

test("a reference inside code is text, not a relation", () => {
  assert.deepEqual(validatePage(parsePage("- write `((b7))` to relate\n  id:: a\n")), []);
});

test("an invalid page reports every problem", () => {
  const problems = validatePage(parsePage("- no id\n- twice\n  id:: x\n- again\n  id:: x\n- see ((y))\n  id:: z\n"));
  assert.equal(problems.length, 3);
  assert.match(problems.join("\n"), /no id/);
  assert.match(problems.join("\n"), /x is used more than once/);
  assert.match(problems.join("\n"), /references y/);
});

test("opening a discussion creates its own repository with round 1", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE, SESSION, new Date(2026, 9, 12, 14, 30));
  assert.deepEqual(ref, { source: "garden", startedAt: "2026-10-12-1430" });
  const dir = store.directory(ref);
  assert.deepEqual(tags(dir), ["round-1"]);
  const { discussion } = await store.read(ref);
  assert.equal(discussion.source, "/notes/garden.md");
  assert.deepEqual(discussion.sessions, [SESSION]);
  assert.equal(discussion.closed, null);
});

test("an invalid copy is refused", async () => {
  await assert.rejects(store.open("garden", "/notes/garden.md", "- no id\n"), StoreError);
});

test("every comment is a commit, and a comment on a missing block is refused", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE);
  const comment = await store.addComment(ref, "b4", "too vague");
  await store.editComment(ref, comment.id, "too vague, name the gain");
  await store.deleteComment(ref, comment.id);
  assert.deepEqual(log(store.directory(ref)).slice(0, 3), [
    "Delete the comment on b4",
    "Edit the comment on b4",
    "Comment on b4",
  ]);
  await assert.rejects(store.addComment(ref, "b99", "nowhere"), /no block b99/);
});

test("a new version starts with no annotations and is tagged", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE);
  await store.addComment(ref, "b2", "shorter");
  await store.beginRound(ref, SESSION);
  const version = await store.saveVersion(ref, PAGE.replace("need more sun", "need less shade"), SESSION);
  assert.equal(version, 2);
  const { discussion, pageMd } = await store.read(ref);
  assert.deepEqual(discussion.annotations, []);
  assert.match(pageMd, /need less shade/);
  assert.deepEqual(tags(store.directory(ref)).sort(), ["round-1", "round-2"]);
});

test("a version is refused while another session carries out a round", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE);
  await store.beginRound(ref, SESSION);
  await assert.rejects(store.saveVersion(ref, PAGE, OTHER), /session-a/);
  await assert.rejects(store.beginRound(ref, OTHER), /session-a/);
});

test("opening again closes the open discussion, which becomes read-only", async () => {
  const first = await store.open("garden", "/notes/garden.md", PAGE, undefined, new Date(2026, 9, 12, 14, 30));
  const second = await store.open("garden", "/notes/garden.md", PAGE, undefined, new Date(2026, 9, 12, 16, 0));
  assert.notEqual((await store.read(first)).discussion.closed, null);
  await assert.rejects(store.addComment(first, "b1", "late"), /read-only/);
  assert.deepEqual(await store.openDiscussionOf("garden"), second);
  assert.deepEqual(await store.discussionsOf("garden"), [first, second]);
});

test("resuming records the session once", async () => {
  await store.open("garden", "/notes/garden.md", PAGE, SESSION);
  const ref = await store.resume("garden", OTHER);
  await store.resume("garden", OTHER);
  const { discussion } = await store.read(ref);
  assert.deepEqual(discussion.sessions.map((session) => session.id), ["session-a", "session-b"]);
  await assert.rejects(store.resume("missing", OTHER), /no open discussion/);
});

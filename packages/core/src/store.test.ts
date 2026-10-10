import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";

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

test("a discussion commits under the tool's own identity", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE);
  const author = execFileSync("git", ["-C", store.directory(ref), "log", "-1", "--format=%an <%ae>"], { encoding: "utf8" }).trim();
  assert.equal(author, "topic overview <topic-overview@localhost>");
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
  const version = await store.saveVersion(ref, PAGE.replace("need more sun", "need less shade"), 1, SESSION);
  assert.equal(version, 2);
  const { discussion, pageMd } = await store.read(ref);
  assert.deepEqual(discussion.annotations, []);
  assert.match(pageMd, /need less shade/);
  assert.deepEqual(tags(store.directory(ref)).sort(), ["round-1", "round-2"]);
});

test("a copy made from an outdated version is refused", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE);
  await store.saveVersion(ref, PAGE, 1, SESSION);
  await assert.rejects(store.saveVersion(ref, PAGE, 1, OTHER), /made from version 1, but the discussion is at version 2/);
});

test("opening again closes the open discussion, which becomes read-only", async () => {
  const first = await store.open("garden", "/notes/garden.md", PAGE, undefined, new Date(2026, 9, 12, 14, 30));
  const second = await store.open("garden", "/notes/garden.md", PAGE, undefined, new Date(2026, 9, 12, 16, 0));
  assert.notEqual((await store.read(first)).discussion.closed, null);
  assert.equal((await store.read(first)).discussion.resolution, "started-over");
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

test("a version brings its attachments, checked against its page", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE);
  const dir = join(root, "work-attachments");
  await mkdir(dir);
  await writeFile(join(dir, "a1-flow.mmd"), "flowchart LR\n  Sow --> Harvest\n");
  const attachment = { id: "a1", file: "a1-flow.mmd", kind: "mermaid", title: "Flow", author: "agent", blocks: ["b4"], time: "2026-10-13T10:00:00Z" };
  await writeFile(join(dir, "index.json"), JSON.stringify([attachment]));
  await store.saveVersion(ref, PAGE, 1, SESSION, dir);
  assert.deepEqual((await store.read(ref)).attachments, [attachment]);

  await writeFile(join(dir, "index.json"), JSON.stringify([{ ...attachment, blocks: ["b99"], file: "missing.mmd" }]));
  await assert.rejects(store.saveVersion(ref, PAGE, 2, SESSION, dir), /missing\.mmd[\s\S]*b99/);

  await store.saveVersion(ref, PAGE, 2, SESSION);
  assert.equal((await store.read(ref)).attachments.length, 1, "a copy without attachments keeps them");
});

test("a discussion can carry the sessions of the one it replaces", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE, OTHER, new Date(), { carried: [SESSION] });
  assert.deepEqual((await store.read(ref)).discussion.sessions.map((session) => session.id), ["session-a", "session-b"]);
});

test("integrations are added once, survive a new version and carry over", async () => {
  const ref = await store.open("garden", "/notes/garden.md", PAGE);
  const first = await store.addIntegration(ref, "local", "garden:server");
  assert.deepEqual(await store.addIntegration(ref, "local", "garden:server"), first);
  await assert.rejects(store.addIntegration(ref, "printer", "x"), /not a kind of integration/);
  await store.saveVersion(ref, PAGE, 1, SESSION);
  assert.deepEqual((await store.read(ref)).discussion.integrations, [first]);
  const next = await store.open("garden", "/notes/garden.md", PAGE, undefined, new Date(Date.now() + 120_000), { integrations: [first] });
  assert.deepEqual((await store.read(next)).discussion.integrations, [first]);
  await store.removeIntegration(next, first.id);
  assert.deepEqual((await store.read(next)).discussion.integrations, []);
});

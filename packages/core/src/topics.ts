// A discussion on the source itself. The source is a page of the knowledge
// base, and a discussion of it is a branch of the knowledge base's
// repository, `discussion/<key>`, checked out in a worktree beside the
// knowledge base: `<worktrees>/<key>/`. The discussion's state is
// `<worktrees>/<key>.json`, next to the worktree rather than in it, so git
// never sees it. A topic has at most one open discussion at a time, so its
// key names it.

import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { randomUUID } from "node:crypto";

import type { Integration, Session } from "./discussion.ts";
import { blockName, idAt, locate, ownText, replaceBlock, setId, withOwnText } from "./edit.ts";
import { StoreError } from "./store.ts";

const run = promisify(execFile);
const KEY = /^[A-Za-z0-9][\w.-]*$/;

// The knowledge base: TOPIC_OVERVIEW_KB, set in .env. A leading ~ stands for
// the home directory.
export function kbRoot(): string {
  const configured = process.env.TOPIC_OVERVIEW_KB;
  if (!configured) throw new StoreError("no knowledge base is configured");
  return configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
}

// Where the worktrees are: TOPIC_OVERVIEW_WORKTREES, set in .env, or a
// folder `worktrees` beside the knowledge base.
export function worktreesRoot(kb: string = kbRoot()): string {
  const configured = process.env.TOPIC_OVERVIEW_WORKTREES;
  if (!configured) return join(dirname(kb), "worktrees");
  return configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
}

// Where the agent that a discussion belongs to runs.
export interface Tmux {
  session: string;
  pane: string;
}

export interface Topic {
  key: string;
  page: string; // the source, relative to the knowledge base, such as pages/<key>-<slug>.md
  branch: string;
  opened: string;
  session?: Session; // the main Claude session
  tmux?: Tmux;
  integrations: Integration[];
  ids?: string[]; // the ids the tool gave blocks, removed at close unless something refers to them
  marks?: Mark[]; // the blocks the agent changed that I have not confirmed seeing
}

// A block the agent changed, marked on the page until I confirm I saw it.
export interface Mark {
  id: string;
  kind: "changed" | "new" | "moved";
}

export interface OpenTopic {
  topic: Topic;
  opened: boolean; // false when the topic was already open, and is returned as it is
}

export class Topics {
  readonly kb: string;
  readonly root: string;

  constructor(kb: string = kbRoot(), root: string = worktreesRoot(kb)) {
    this.kb = kb;
    this.root = root;
  }

  worktree(key: string): string {
    if (!KEY.test(key)) throw new StoreError(`${key} is not a valid key`);
    return join(this.root, key);
  }

  private stateFile(key: string): string {
    return `${this.worktree(key)}.json`;
  }

  // Opens a discussion of the topic: a branch of the knowledge base's `main`
  // checked out in a worktree. A topic already open is returned as it is,
  // since it is worked on once at a time. The knowledge base must be clean,
  // its journals aside, since a change not committed would silently be left
  // out of the discussion, and a page may depend on any other.
  async open(key: string, session?: Session, tmux?: Tmux, now = new Date()): Promise<OpenTopic> {
    const existing = await this.read(key).catch(() => undefined);
    if (existing) return { topic: existing, opened: false };

    await this.refuseUncommitted();
    const page = await this.pageOf(key);
    const branch = `discussion/${key}`;
    if (await this.branchExists(branch)) {
      throw new StoreError(`${branch} exists without an open discussion; close it or delete the branch first`);
    }
    await mkdir(this.root, { recursive: true });
    await git(this.kb, "worktree", "add", "--quiet", "-b", branch, this.worktree(key), "main");
    const topic: Topic = { key, page, branch, opened: now.toISOString(), integrations: [] };
    if (session) topic.session = session;
    if (tmux) topic.tmux = tmux;
    await this.write(topic);
    return { topic, opened: true };
  }

  async read(key: string): Promise<Topic> {
    return JSON.parse(await readFile(this.stateFile(key), "utf8")) as Topic;
  }

  // The source as it stands on the discussion's branch.
  async source(key: string): Promise<{ topic: Topic; text: string }> {
    const topic = await this.read(key);
    return { topic, text: await readFile(join(this.worktree(key), topic.page), "utf8") };
  }

  // The commit the discussion's branch is at.
  async head(key: string): Promise<string> {
    return (await git(this.worktree(key), "rev-parse", "--short", "HEAD")).trim();
  }

  // The source file, as a path to read it from. It is written only through
  // change().
  async sourcePath(key: string): Promise<string> {
    return join(this.worktree(key), (await this.read(key)).page);
  }

  // Changes the source in the worktree and commits the change on the
  // discussion's branch, one commit per change. A change that throws leaves
  // the source as it was.
  async change(key: string, description: string, apply: (text: string) => string, mark?: Mark): Promise<string> {
    const path = await this.sourcePath(key);
    const before = await readFile(path, "utf8");
    const after = apply(before);
    if (after === before) throw new StoreError("the change leaves the source as it was");
    // The mark is written before the source, so the page finds it when the
    // changed source makes it fetch again.
    if (mark) await this.mark(key, mark);
    await writeFile(path, after);
    const worktree = this.worktree(key);
    await git(worktree, "add", "--", path);
    await git(worktree, "commit", "--quiet", "-m", `${key}: ${description}`);
    return this.head(key);
  }

  // Gives the block at the line, which must read as the text, an id in a
  // commit of its own, and records it to be removed at close unless
  // something refers to it. A block that has an id keeps it.
  async setId(key: string, line: number, first: string): Promise<{ id: string; head: string; added: boolean }> {
    const known = idAt(await readFile(await this.sourcePath(key), "utf8"), line, first);
    if (known) return { id: known, head: await this.head(key), added: false };
    const id = randomUUID();
    const head = await this.change(key, `Add an id to the block at line ${line}`, (text) => setId(text, line, first, id));
    await this.recordId(key, id);
    return { id, head, added: true };
  }

  // What the discussion's agent is doing, read from its tmux window, which
  // the status bar marks: busy while it works, waiting when the turn is
  // over. A pane that is gone, or none recorded, has no agent to wait for.
  async agentState(key: string): Promise<"busy" | "waiting" | "idle" | "gone"> {
    const pane = (await this.read(key)).tmux?.pane;
    if (!pane) return "gone";
    try {
      const { stdout } = await run("tmux", ["display-message", "-p", "-t", pane, "#{@window_state}"]);
      const state = stdout.trim();
      return state === "busy" || state === "waiting" ? state : "idle";
    } catch {
      return "gone";
    }
  }

  // A block's own text, as the Edit button shows it.
  async ownText(key: string, view: string): Promise<string> {
    return ownText(await readFile(await this.sourcePath(key), "utf8"), view);
  }

  // Saving from the Edit button: the block's own text replaced, what is under
  // it kept. A block without an id gets one first, as set-id gives it. While
  // the agent works, nothing is saved, so one writer works at a time.
  async editOwnText(key: string, view: string, own: string): Promise<{ id: string; head: string }> {
    if ((await this.agentState(key)) === "busy") throw new StoreError("the agent is working; save once it is done");
    const found = locate(await readFile(await this.sourcePath(key), "utf8"), view);
    const id = found.id ?? (await this.setId(key, found.line, found.first)).id;
    const name = await this.blockName(key, id);
    const head = await this.change(key, `Edit ${name}`, (text) => replaceBlock(text, id, withOwnText(text, id, own)));
    return { id, head };
  }

  // A block named for a commit message, by the start of its text.
  async blockName(key: string, id: string): Promise<string> {
    return blockName(await readFile(await this.sourcePath(key), "utf8"), id);
  }

  // Marks a block the agent changed. A block marked already keeps the first
  // kind it was marked with, so a new block edited further stays new.
  async mark(key: string, mark: Mark): Promise<void> {
    const topic = await this.read(key);
    if (topic.marks?.some((known) => known.id === mark.id)) return;
    topic.marks = [...(topic.marks ?? []), mark];
    await this.write(topic);
  }

  // Confirms a change was seen, clearing its mark.
  async clearMark(key: string, id: string): Promise<Mark[]> {
    const topic = await this.read(key);
    topic.marks = (topic.marks ?? []).filter((known) => known.id !== id);
    await this.write(topic);
    return topic.marks;
  }

  // Records an id the tool gave a block, to be removed at close unless
  // something refers to it.
  async recordId(key: string, id: string): Promise<void> {
    const topic = await this.read(key);
    topic.ids = [...(topic.ids ?? []), id];
    await this.write(topic);
  }

  async list(): Promise<Topic[]> {
    const entries = await readdir(this.root).catch(() => [] as string[]);
    const keys = entries.filter((entry) => entry.endsWith(".json")).map((entry) => entry.slice(0, -".json".length));
    const topics = await Promise.all(keys.map((key) => this.read(key).catch(() => undefined)));
    return topics.filter((topic): topic is Topic => topic !== undefined);
  }

  private async write(topic: Topic): Promise<void> {
    await writeFile(this.stateFile(topic.key), `${JSON.stringify(topic, null, 2)}\n`);
  }

  // A task's page is named `<key>-<slug>.md`, and exactly one may match.
  private async pageOf(key: string): Promise<string> {
    const pages = await readdir(join(this.kb, "pages"));
    const matches = pages.filter((file) => file.startsWith(`${key}-`) && file.endsWith(".md"));
    if (matches.length === 0) throw new StoreError(`there is no page for ${key}`);
    if (matches.length > 1) throw new StoreError(`more than one page matches ${key}: ${matches.join(", ")}`);
    return join("pages", matches[0]);
  }

  // The journals are written all day by other tools, and a discussion never
  // edits them, so they are left out, as the knowledge base's commit rules do.
  private async refuseUncommitted(): Promise<void> {
    const changes = (await git(this.kb, "status", "--porcelain", "--", ".", ":!journals")).trimEnd();
    if (changes) throw new StoreError(`the knowledge base has changes not committed; commit them first:\n${changes}`);
  }

  private async branchExists(branch: string): Promise<boolean> {
    return git(this.kb, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`).then(
      () => true,
      () => false,
    );
  }
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd });
  return stdout;
}

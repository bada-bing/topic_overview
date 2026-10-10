// The discussion store. Every discussion is a directory
// `<root>/<source>/<started-at>/` and a git repository of its own, holding
// `page.md` and `discussion.json`. Every comment is a commit, and every
// version is a commit tagged `round-<n>`.

import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

import { type Attachment, readAttachments, validateAttachments } from "./attachments.ts";
import { type Annotation, type Discussion, type Resolution, newDiscussion, parseDiscussion, serializeDiscussion } from "./discussion.ts";
import { parsePage, validatePage } from "./page.ts";

const run = promisify(execFile);

// Where discussions live: TOPIC_OVERVIEW_DISCUSSIONS, set in .env, or a
// neutral default. A leading ~ stands for the home directory.
export function discussionsRoot(): string {
  const configured = process.env.TOPIC_OVERVIEW_DISCUSSIONS;
  if (!configured) return join(homedir(), ".local/share/topic-overview/discussions");
  return configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
}
const NAME = /^[A-Za-z0-9][\w.-]*$/;

export class StoreError extends Error {}

export interface DiscussionRef {
  source: string; // the source's name, such as a task key
  startedAt: string;
}

export interface OpenOptions {
  sourceHash?: string; // the SHA-256 of the source as it was copied
  carried?: SessionInfo[]; // sessions of the discussion this one replaces
  closing?: Resolution; // why the discussion still open on the source is closed
}

export interface SessionInfo {
  id: string;
  transcript: string;
}

export class Store {
  readonly root: string;

  constructor(root: string = discussionsRoot()) {
    this.root = root;
  }

  directory(ref: DiscussionRef): string {
    checkName(ref.source);
    checkName(ref.startedAt);
    return join(this.root, ref.source, ref.startedAt);
  }

  // Opens a discussion on a copy of its source, closing the one still open on
  // the same source. The copy is refused when it is not a valid page.
  async open(
    source: string,
    sourcePath: string,
    pageMd: string,
    session?: SessionInfo,
    now = new Date(),
    options: OpenOptions = {},
  ): Promise<DiscussionRef> {
    const { sourceHash, carried = [], closing = "started-over" } = options;
    checkName(source);
    refuseInvalid(pageMd);

    const previous = await this.openDiscussionOf(source);
    if (previous) await this.close(previous, closing, session, now);

    const ref = { source, startedAt: await this.freeStartedAt(source, now) };
    const dir = this.directory(ref);
    await mkdir(dir, { recursive: true });
    await git(dir, "init", "--quiet", "--initial-branch=main");

    const discussion = newDiscussion(sourcePath, now.toISOString());
    if (sourceHash) discussion.sourceHash = sourceHash;
    for (const known of carried) addSession(discussion, known);
    if (session) addSession(discussion, session);
    await writeFile(join(dir, "page.md"), pageMd);
    await this.write(ref, discussion);
    await commit(dir, `Open the discussion on ${source}`, session);
    await git(dir, "tag", "round-1");
    return ref;
  }

  async read(ref: DiscussionRef): Promise<{ discussion: Discussion; pageMd: string; attachments: Attachment[] }> {
    const dir = this.directory(ref);
    const [json, pageMd, attachments] = await Promise.all([
      readFile(join(dir, "discussion.json"), "utf8"),
      readFile(join(dir, "page.md"), "utf8"),
      readAttachments(join(dir, "attachments")),
    ]);
    return { discussion: parseDiscussion(json), pageMd, attachments };
  }

  // The path of one attachment's file, refused unless the index names it.
  async attachmentFile(ref: DiscussionRef, file: string): Promise<string> {
    const { attachments } = await this.read(ref);
    if (!attachments.some((attachment) => attachment.file === file)) throw new StoreError(`there is no attachment ${file}`);
    return join(this.directory(ref), "attachments", file);
  }

  async addComment(ref: DiscussionRef, target: string, body: string, author = "me", now = new Date()): Promise<Annotation> {
    const { discussion, pageMd } = await this.readOpen(ref);
    const ids = new Set(blockIds(pageMd));
    if (!ids.has(target)) throw new StoreError(`there is no block ${target} on the page`);
    const annotation: Annotation = { id: randomUUID(), type: "comment", target, author, time: now.toISOString(), body };
    discussion.annotations.push(annotation);
    await this.write(ref, discussion);
    await commit(this.directory(ref), `Comment on ${target}`);
    return annotation;
  }

  async editComment(ref: DiscussionRef, id: string, body: string): Promise<Annotation> {
    const { discussion } = await this.readOpen(ref);
    const annotation = discussion.annotations.find((candidate) => candidate.id === id);
    if (!annotation) throw new StoreError(`there is no comment ${id}`);
    annotation.body = body;
    await this.write(ref, discussion);
    await commit(this.directory(ref), `Edit the comment on ${annotation.target}`);
    return annotation;
  }

  async deleteComment(ref: DiscussionRef, id: string): Promise<void> {
    const { discussion } = await this.readOpen(ref);
    const annotation = discussion.annotations.find((candidate) => candidate.id === id);
    if (!annotation) throw new StoreError(`there is no comment ${id}`);
    discussion.annotations = discussion.annotations.filter((candidate) => candidate.id !== id);
    await this.write(ref, discussion);
    await commit(this.directory(ref), `Delete the comment on ${annotation.target}`);
  }

  // Saves the changed copy as a new version, which starts with no
  // annotations. The copy names the version it was made from, and a copy made
  // from an outdated version is refused, so no version is written over
  // another session's. A copy that brings attachments replaces the previous
  // ones; one that brings none keeps them.
  async saveVersion(
    ref: DiscussionRef,
    pageMd: string,
    fromVersion: number,
    session: SessionInfo,
    attachmentsDir?: string,
  ): Promise<number> {
    const { discussion } = await this.readOpen(ref);
    if (discussion.version !== fromVersion) {
      throw new StoreError(
        `the copy was made from version ${fromVersion}, but the discussion is at version ${discussion.version}`,
      );
    }
    refuseInvalid(pageMd);
    if (attachmentsDir) {
      const problems = await validateAttachments(attachmentsDir, await readAttachments(attachmentsDir), new Set(blockIds(pageMd)));
      if (problems.length > 0) throw new StoreError(`the attachments are not valid:\n- ${problems.join("\n- ")}`);
    }
    const dir = this.directory(ref);
    discussion.version += 1;
    discussion.annotations = [];
    addSession(discussion, session);
    await writeFile(join(dir, "page.md"), pageMd);
    if (attachmentsDir) {
      await rm(join(dir, "attachments"), { recursive: true, force: true });
      await cp(attachmentsDir, join(dir, "attachments"), { recursive: true });
    }
    await this.write(ref, discussion);
    await commit(dir, `Save version ${discussion.version}`, session);
    await git(dir, "tag", `round-${discussion.version}`);
    return discussion.version;
  }

  async close(ref: DiscussionRef, resolution: Resolution, session?: SessionInfo, now = new Date()): Promise<void> {
    const { discussion } = await this.readOpen(ref);
    discussion.closed = now.toISOString();
    discussion.resolution = resolution;
    if (session) addSession(discussion, session);
    await this.write(ref, discussion);
    await commit(this.directory(ref), "Close the discussion", session);
  }

  async resume(source: string, session: SessionInfo): Promise<DiscussionRef> {
    const ref = await this.openDiscussionOf(source);
    if (!ref) throw new StoreError(`there is no open discussion of ${source}`);
    const { discussion } = await this.read(ref);
    if (!discussion.sessions.some((known) => known.id === session.id)) {
      addSession(discussion, session);
      await this.write(ref, discussion);
      await commit(this.directory(ref), "Resume the discussion", session);
    }
    return ref;
  }

  // Every discussion of a source, oldest first.
  async discussionsOf(source: string): Promise<DiscussionRef[]> {
    checkName(source);
    let entries: string[];
    try {
      entries = await readdir(join(this.root, source));
    } catch {
      return [];
    }
    return entries.filter((entry) => NAME.test(entry)).sort().map((startedAt) => ({ source, startedAt }));
  }

  async openDiscussionOf(source: string): Promise<DiscussionRef | undefined> {
    for (const ref of (await this.discussionsOf(source)).reverse()) {
      const { discussion } = await this.read(ref);
      if (!discussion.closed) return ref;
    }
    return undefined;
  }

  private async readOpen(ref: DiscussionRef) {
    const contents = await this.read(ref);
    if (contents.discussion.closed) throw new StoreError("the discussion is closed and read-only");
    return contents;
  }

  private async write(ref: DiscussionRef, discussion: Discussion): Promise<void> {
    await writeFile(join(this.directory(ref), "discussion.json"), serializeDiscussion(discussion));
  }

  private async freeStartedAt(source: string, now: Date): Promise<string> {
    const taken = new Set((await this.discussionsOf(source)).map((ref) => ref.startedAt));
    const minute = stamp(now, false);
    if (!taken.has(minute)) return minute;
    const second = stamp(now, true);
    if (!taken.has(second)) return second;
    throw new StoreError(`a discussion of ${source} was already opened at ${second}`);
  }
}

function checkName(name: string): void {
  if (!NAME.test(name)) throw new StoreError(`"${name}" is not a valid name`);
}

function refuseInvalid(pageMd: string): void {
  const problems = validatePage(parsePage(pageMd));
  if (problems.length > 0) throw new StoreError(`the page is not valid:\n- ${problems.join("\n- ")}`);
}

function blockIds(pageMd: string): string[] {
  const ids: string[] = [];
  const visit = (blocks: ReturnType<typeof parsePage>["blocks"]) => {
    for (const block of blocks) {
      ids.push(block.id);
      visit(block.children);
    }
  };
  visit(parsePage(pageMd).blocks);
  return ids;
}

function addSession(discussion: Discussion, session: SessionInfo): void {
  if (!discussion.sessions.some((known) => known.id === session.id)) discussion.sessions.push(session);
}

// Local time, so a directory reads as the moment I opened it.
function stamp(date: Date, withSeconds: boolean): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return withSeconds ? `${base}${pad(date.getSeconds())}` : base;
}

async function git(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", dir, ...args]);
  return stdout;
}

// The tool commits under an identity of its own, so a commit never depends on
// how the machine's git is set up; who worked on a version is its Session
// trailer.
const AUTHOR = ["-c", "user.name=topic overview", "-c", "user.email=topic-overview@localhost"];

async function commit(dir: string, subject: string, session?: SessionInfo): Promise<void> {
  await git(dir, "add", "--all");
  const message = session ? `${subject}\n\nSession: ${session.id}` : subject;
  await run("git", [...AUTHOR, "-C", dir, "commit", "--quiet", "--allow-empty", "-m", message]);
}

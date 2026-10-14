// A discussion on the source itself. The source is a page of the knowledge
// base, and a discussion of it is a branch of the knowledge base's
// repository, `discussion/<key>`, checked out in a worktree beside the
// knowledge base: `<worktrees>/<key>/`. The discussion's state is
// `<worktrees>/<key>.json`, next to the worktree rather than in it, so git
// never sees it. A topic has at most one open discussion at a time, so its
// key names it.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

import { randomUUID } from "node:crypto";

import { INTEGRATION_KINDS, type Integration, type IntegrationKind, type Session, type Tab } from "./discussion.ts";
import { blockName, idAt, locate, ownText, removeId, replaceBlock, setId, withOwnText } from "./edit.ts";
import { type Mark, markKey } from "./mark.ts";
import { deploymentReference } from "./cluster.ts";
import { processAddress, processWindow, startProcess } from "./process.ts";
import type { Question } from "./question.ts";
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

// Where the agent that a discussion belongs to runs: a tmux session and a
// window in it. Without one recorded, it is the session named after the
// topic's key; without a window, that session's first, where the assistant
// runs. It is looked up each time it is needed, so it is always whatever
// runs there now.
export interface Tmux {
  session: string;
  window?: string;
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
  questions?: Question[]; // what I asked the agent about blocks, until I dismiss it
  closed?: string; // the commit on main the discussion closed into, while what is left of it is removed
}

// How a discussion closed: the commit on main it was squashed into, or none
// when it changed nothing, or was discarded.
export interface Closed {
  commit?: string;
  subject?: string;
}


export type AgentState = "busy" | "waiting" | "idle" | "gone";

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
    const conflicted = await this.conflict(key);
    if (conflicted.length > 0) {
      throw new StoreError(`merging main stopped on a conflict in ${conflicted.join(", ")}; resolve it in the terminal first`);
    }
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

  // The files a merge from main stopped on, while it is unfinished; none
  // otherwise. Nothing is written to the branch until it is resolved.
  async conflict(key: string): Promise<string[]> {
    const worktree = this.worktree(key);
    const merging = await git(worktree, "rev-parse", "--quiet", "--verify", "MERGE_HEAD").then(
      () => true,
      () => false,
    );
    if (!merging) return [];
    return (await git(worktree, "diff", "--name-only", "--diff-filter=U")).split("\n").filter(Boolean);
  }

  // Merges what is new on main into the discussion's branch, never
  // rebasing, and tells which files it changed. A merge that conflicts
  // stops, and is left for the terminal.
  async mergeMain(key: string): Promise<{ files: string[] } | { conflict: string[] }> {
    const conflicted = await this.conflict(key);
    if (conflicted.length > 0) return { conflict: conflicted };
    const worktree = this.worktree(key);
    const current = await git(worktree, "merge-base", "--is-ancestor", "main", "HEAD").then(
      () => true,
      () => false,
    );
    if (current) return { files: [] };
    const before = (await git(worktree, "rev-parse", "HEAD")).trim();
    try {
      await git(worktree, "merge", "--no-edit", "--quiet", "main");
    } catch (failure) {
      const conflicted = await this.conflict(key);
      if (conflicted.length === 0) throw new StoreError(`merging main failed: ${(failure as Error).message}`);
      return { conflict: conflicted };
    }
    return { files: (await git(worktree, "diff", "--name-only", before, "HEAD")).split("\n").filter(Boolean) };
  }

  // What the discussion's agent is doing, read from its tmux window, which
  // the status bar marks: busy while it works, waiting when the turn is
  // over. A window that is gone, or one where Claude does not run, has no
  // agent to wait for or to ask.
  async agentState(key: string): Promise<AgentState> {
    return (await this.agent(key)).state;
  }

  // The agent's state, and where it runs, named as tmux names it:
  // `<session>:<window>`.
  async agent(key: string): Promise<{ state: AgentState; name?: string }> {
    const target = await this.agentWindow(key);
    try {
      const format = "#{pane_current_command}\t#{@window_state}\t#{session_name}:#{window_name}";
      const { stdout } = await run("tmux", ["display-message", "-p", "-t", target, format]);
      const [command, state, name] = stdout.trimEnd().split("\t");
      // A session that does not exist is answered with empty fields.
      if (!name || name.startsWith(":")) return { state: "gone" };
      if (command !== "claude") return { state: "gone", name };
      return { state: state === "busy" || state === "waiting" ? state : "idle", name };
    } catch {
      return { state: "gone" };
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
    if (topic.marks?.some((known) => markKey(known) === markKey(mark))) return;
    topic.marks = [...(topic.marks ?? []), mark];
    await this.write(topic);
  }

  // Confirms a change was seen, clearing its mark. While the agent works,
  // nothing is confirmed, since it writes the marks.
  async clearMark(key: string, which: string): Promise<Mark[]> {
    if ((await this.agentState(key)) === "busy") throw new StoreError("the agent is working; confirm once it is done");
    const topic = await this.read(key);
    topic.marks = (topic.marks ?? []).filter((known) => markKey(known) !== which);
    await this.write(topic);
    return topic.marks;
  }

  // Asks the discussion's agent about a block: the question is kept, and the
  // prompt typed into the agent's pane, naming the block, what it reads and
  // how to answer. A block without an id is given one first, as the Edit
  // button gives it, so the question stays with its block wherever it moves.
  // While the agent works, nothing is asked, so one writer works at a time.
  async ask(key: string, view: string, prompt: string, now = new Date()): Promise<Question> {
    await this.refuseAsking(key, prompt);
    const found = locate(await readFile(await this.sourcePath(key), "utf8"), view);
    const block = found.id ?? (await this.setId(key, found.line, found.first)).id;
    const question: Question = {
      id: randomUUID().slice(0, 8),
      block,
      text: ownText(await readFile(await this.sourcePath(key), "utf8"), block),
      commit: await this.head(key),
      exchanges: [{ prompt: prompt.trim(), asked: now.toISOString() }],
    };
    await this.keep(key, question);
    await this.tellAgent(key, question, [
      `Question ${question.id} in the discussion of ${key}, about the block with id ${block}`,
      `of ${await this.sourcePath(key)}, which reads "${clip(question.text)}": ${oneLine(prompt.trim())}`,
    ]);
    return question;
  }

  // Asks further in a question's exchange, once its last answer has come.
  async followUp(key: string, id: string, prompt: string, now = new Date()): Promise<Question> {
    await this.refuseAsking(key, prompt);
    const question = (await this.read(key)).questions?.find((known) => known.id === id);
    if (!question) throw new StoreError(`there is no question ${id} in the discussion of ${key}`);
    if (question.exchanges.at(-1)?.answer === undefined) throw new StoreError("the question is not answered yet; ask further once it is");
    const asked = { ...question, exchanges: [...question.exchanges, { prompt: prompt.trim(), asked: now.toISOString() }] };
    await this.keep(key, asked);
    await this.tellAgent(key, asked, [
      `Follow-up to question ${id} in the discussion of ${key}, about the block with id ${question.block}:`,
      oneLine(prompt.trim()),
    ]);
    return asked;
  }

  // The agent's answer to the last thing asked in a question, shown beside
  // its block.
  async answer(key: string, id: string, answer: string, now = new Date()): Promise<Question> {
    if (answer.trim() === "") throw new StoreError("an answer needs text");
    const topic = await this.read(key);
    const question = (topic.questions ?? []).find((known) => known.id === id);
    if (!question) throw new StoreError(`there is no question ${id} in the discussion of ${key}`);
    const last = question.exchanges.at(-1)!;
    if (last.answer !== undefined) throw new StoreError(`question ${id} is answered already; nothing new was asked`);
    last.answer = answer.trim();
    last.answered = now.toISOString();
    await this.write(topic);
    return question;
  }

  private async refuseAsking(key: string, prompt: string): Promise<void> {
    if (prompt.trim() === "") throw new StoreError("a question needs text");
    const state = await this.agentState(key);
    if (state === "busy") throw new StoreError("the agent is working; ask once it is done");
    if (state === "gone") throw new StoreError("no Claude session runs in the discussion's window, so there is nobody to ask");
  }

  // A question kept, replacing what was kept of it before.
  private async keep(key: string, question: Question): Promise<void> {
    const topic = await this.read(key);
    const others = (topic.questions ?? []).filter((known) => known.id !== question.id);
    await this.write({ ...topic, questions: [...others, question] });
  }

  // Types what was asked into the agent's pane, with how to answer. What
  // does not reach the agent is taken back, so nothing waits for an answer
  // that cannot come.
  private async tellAgent(key: string, question: Question, said: string[]): Promise<void> {
    const line = [...said, `Answer it with topic answer ${key} ${question.id}, as the discussion skill says.`].join(" ");
    try {
      await this.type(await this.agentWindow(key), line);
    } catch (failure) {
      const asked = { ...question, exchanges: question.exchanges.slice(0, -1) };
      const topic = await this.read(key);
      const others = (topic.questions ?? []).filter((known) => known.id !== question.id);
      await this.write({ ...topic, questions: asked.exchanges.length > 0 ? [...others, asked] : others });
      throw new StoreError(`the question did not reach the agent: ${(failure as Error).message}`);
    }
  }

  // Brings the agent's window up in the terminal.
  async focusAgent(key: string): Promise<void> {
    await raise(await this.agentWindow(key));
  }

  // The tmux window the discussion's agent runs in, as a target: the one
  // recorded, or the first window of the session named after the key.
  private async agentWindow(key: string): Promise<string> {
    const { session, window } = (await this.read(key)).tmux ?? { session: key };
    return `=${session}:${window ?? "^"}`;
  }

  // Moves the discussion to another agent: a tmux session, and a window in
  // it when not its first.
  async setAgent(key: string, tmux: Tmux): Promise<void> {
    const topic = await this.read(key);
    await this.write({ ...topic, tmux });
  }

  // Brings up a window in the discussion's tmux session working in its
  // worktree, named after the knowledge base, such as `KB`, made the first
  // time it is asked for.
  async focusWorktree(key: string): Promise<void> {
    const session = (await this.read(key)).tmux?.session ?? key;
    const name = basename(this.kb);
    const { stdout } = await run("tmux", ["list-windows", "-t", `=${session}`, "-F", "#{window_name}"]);
    if (!stdout.split("\n").includes(name)) {
      await run("tmux", ["new-window", "-d", "-t", `=${session}:`, "-n", name, "-c", this.worktree(key)]);
    }
    await raise(`=${session}:${name}`);
  }

  // Adds what the discussion depends on outside its source, as the agent or
  // I decide: a local process, a deployment, a Jenkins build the agent
  // started, never a job's last build, since others start the same job, or
  // a page open in a browser.
  // Its id is its kind and reference, so the same one is not added twice. A
  // merge request is read off the page's Links instead, never added.
  async addIntegration(key: string, kind: string, reference: string, label?: string): Promise<Integration> {
    if (!(INTEGRATION_KINDS as readonly string[]).includes(kind) || kind === "merge-request") {
      throw new StoreError("an integration is local, cluster, jenkins or browser; a merge request is listed under Links");
    }
    if (kind === "local") processAddress(reference);
    if (kind === "cluster") deploymentReference(reference);
    if (kind === "browser" && !/^https?:\/\/\S+$/.test(reference)) throw new StoreError(`a page is its URL, not ${reference}`);
    if (kind === "jenkins" && !/^[^#/]*[^#/\s](\/[^#/]*[^#/\s])*#\d+$/.test(reference)) {
      throw new StoreError(`a build is <job>#<number>, with folders as <folder>/<job>, not ${reference}`);
    }
    const topic = await this.read(key);
    const id = `${kind}:${reference}`;
    const known = topic.integrations.find((integration) => integration.id === id);
    if (known) return known;
    const added: Integration = { id, kind: kind as IntegrationKind, reference, ...(label ? { label } : {}) };
    await this.write({ ...topic, integrations: [...topic.integrations, added] });
    return added;
  }

  // Records the tab the view opened a browser page in, and how to reach it,
  // so the page is that tab from then on, and an agent reading the state can
  // attach to it.
  async setTab(key: string, id: string, tab: Tab): Promise<void> {
    const topic = await this.read(key);
    const integration = topic.integrations.find((known) => known.id === id);
    if (integration?.kind !== "browser") throw new StoreError(`${key} has no browser integration ${id}`);
    integration.tab = tab;
    await this.write(topic);
  }

  async removeIntegration(key: string, id: string): Promise<void> {
    const topic = await this.read(key);
    if (!topic.integrations.some((integration) => integration.id === id)) throw new StoreError(`${key} has no integration ${id}`);
    await this.write({ ...topic, integrations: topic.integrations.filter((integration) => integration.id !== id) });
  }

  // Brings a local integration's window up in the terminal.
  async focusProcess(key: string, id: string): Promise<void> {
    const window = await processWindow(await this.processOf(key, id));
    if (!window) throw new StoreError(`${id.slice("local:".length)} has no window; start it first`);
    await raise(window);
  }

  // Starts a local integration's process, or restarts it when it runs. While
  // the agent works, nothing is started, since it may be using the process.
  async startProcess(key: string, id: string): Promise<string> {
    const address = await this.processOf(key, id);
    if ((await this.agentState(key)) === "busy") throw new StoreError("the agent is working; start it once it is done");
    return startProcess(address);
  }

  // Only a process the discussion lists is reached, never one named by the
  // caller.
  private async processOf(key: string, id: string) {
    const integration = (await this.read(key)).integrations.find((known) => known.id === id);
    if (integration?.kind !== "local") throw new StoreError(`${key} has no local integration ${id}`);
    return processAddress(integration.reference);
  }

  // A question I am done with. While the agent works, nothing is dismissed,
  // since it may be answering.
  async dismiss(key: string, id: string): Promise<Question[]> {
    if ((await this.agentState(key)) === "busy") throw new StoreError("the agent is working; dismiss once it is done");
    const topic = await this.read(key);
    topic.questions = (topic.questions ?? []).filter((known) => known.id !== id);
    await this.write(topic);
    return topic.questions;
  }

  // Types a line into a window and submits it, as if I had typed it there.
  // The line is submitted apart, since an agent may take a fast run of keys
  // for a paste and keep it in its input.
  private async type(target: string, line: string): Promise<void> {
    await run("tmux", ["send-keys", "-t", target, "-l", line]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await run("tmux", ["send-keys", "-t", target, "Enter"]);
  }

  // Records an id the tool gave a block, to be removed at close unless
  // something refers to it.
  async recordId(key: string, id: string): Promise<void> {
    const topic = await this.read(key);
    topic.ids = [...(topic.ids ?? []), id];
    await this.write(topic);
  }

  // Closes the discussion into main: main merged one last time, the ids the
  // tool gave removed unless something refers to them, and the branch
  // squashed into one commit on main, named by the knowledge base's commit
  // rules. A discussion that changed nothing makes no commit. Main moves by
  // fast-forward only, so it either has the whole commit or none of it; what
  // is left of the discussion is removed after, and closing again finishes
  // a removal that stopped part way.
  async close(key: string): Promise<Closed> {
    const topic = await this.read(key);
    if (topic.closed) {
      await this.remove(topic);
      return { commit: topic.closed };
    }
    await this.refuseUncommitted();
    const checkedOut = (await git(this.kb, "branch", "--show-current")).trim();
    if (checkedOut !== "main") throw new StoreError(`the knowledge base is on ${checkedOut || "no branch"}, not main`);
    const merged = await this.mergeMain(key);
    if ("conflict" in merged) {
      throw new StoreError(`merging main stopped on a conflict in ${merged.conflict.join(", ")}; resolve it in the terminal first`);
    }
    await this.removeIds(key);

    const worktree = this.worktree(key);
    const main = (await git(this.kb, "rev-parse", "main")).trim();
    const current = await git(worktree, "merge-base", "--is-ancestor", main, "HEAD").then(
      () => true,
      () => false,
    );
    if (!current) throw new StoreError("main moved while the discussion was closing; close it again");
    const changed = (await git(worktree, "diff", "--name-only", main, "HEAD")).split("\n").filter(Boolean);
    if (changed.length === 0) {
      await this.remove(topic);
      return {};
    }
    const subject = `${key}: ${phaseOf(await readFile(join(worktree, topic.page), "utf8")) ?? "Update"}`;
    const others = changed
      .filter((file) => file !== topic.page && file.startsWith("pages/") && file.endsWith(".md"))
      .map((file) => `- update ${basename(file, ".md").replaceAll("%2F", "/")}`);
    const message = others.length > 0 ? `${subject}\n\n${others.join("\n")}\n` : `${subject}\n`;
    const commit = (await git(this.kb, "commit-tree", `${topic.branch}^{tree}`, "-p", main, "-m", message)).trim();
    await git(this.kb, "merge", "--ff-only", "--quiet", commit);
    const short = (await git(this.kb, "rev-parse", "--short", commit)).trim();
    await this.write({ ...(await this.read(key)), closed: short });
    await this.remove(topic);
    return { commit: short, subject };
  }

  // Ends the discussion with nothing merged: its worktree, branch and state
  // are removed, and main is left as it is.
  async discard(key: string): Promise<void> {
    await this.remove(await this.read(key));
  }

  // The ids the tool gave blocks removed, in a commit of their own, unless a
  // reference anywhere in the knowledge base points at one.
  private async removeIds(key: string): Promise<void> {
    const ids = (await this.read(key)).ids ?? [];
    const worktree = this.worktree(key);
    const unreferenced: string[] = [];
    for (const id of ids) {
      const referred = await git(worktree, "grep", "--quiet", "-F", `((${id}))`).then(
        () => true,
        () => false,
      );
      if (!referred) unreferenced.push(id);
    }
    const before = await readFile(await this.sourcePath(key), "utf8");
    const after = unreferenced.reduce(removeId, before);
    if (after !== before) await this.change(key, "Remove the ids the discussion added", () => after);
  }

  // The tabs the view opened, the worktree, the branch and the state, each
  // removed if it is still there, the state last, so a removal that stops
  // part way is finished by closing again. A tab is closed through the
  // browser's own endpoint, and one the browser no longer has, or a browser
  // that is not running, is left as it is.
  private async remove(topic: Topic): Promise<void> {
    for (const { tab } of topic.integrations) {
      if (tab) await fetch(`${tab.endpoint}/json/close/${tab.id}`, { signal: AbortSignal.timeout(3_000) }).catch(() => undefined);
    }
    const worktree = this.worktree(topic.key);
    if (existsSync(worktree)) await git(this.kb, "worktree", "remove", "--force", worktree);
    await git(this.kb, "worktree", "prune");
    if (await this.branchExists(topic.branch)) await git(this.kb, "branch", "--quiet", "-D", topic.branch);
    await rm(this.stateFile(topic.key), { force: true });
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

// A tmux window made current in its session, the last client used switched
// to that session, and the terminal app, TOPIC_OVERVIEW_TERMINAL in .env,
// raised. Without a client or a terminal app configured, only tmux moves.
async function raise(target: string): Promise<void> {
  await run("tmux", ["select-window", "-t", target]);
  await run("tmux", ["switch-client", "-t", target]).catch(() => undefined);
  const terminal = process.env.TOPIC_OVERVIEW_TERMINAL;
  if (terminal) await run("/usr/bin/open", ["-a", terminal]);
}

// A text on one line, as a prompt typed into a pane must be: a new line
// would submit it.
function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " / ");
}

// A block's text, shortened for a prompt; the agent reads the rest in the
// source.
function clip(text: string): string {
  const flat = oneLine(text);
  return flat.length > 200 ? `${flat.slice(0, 199)}…` : flat;
}

// The phase a task page is in, as its Task Progress heading names it after
// the marker: `### 🌗 Implement the Solution` is in Implement the Solution.
// A page with no Task Progress has none.
function phaseOf(text: string): string | undefined {
  const lines = text.split("\n");
  const progress = lines.findIndex((line) => /^\t*- ## Task Progress\s*$/.test(line));
  if (progress === -1) return undefined;
  for (const line of lines.slice(progress + 1)) {
    if (/^\t*- ## /.test(line)) return undefined;
    const phase = /^\t*- ### \S+ (.+?)\s*$/.exec(line);
    if (phase) return phase[1];
  }
  return undefined;
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd });
  return stdout;
}

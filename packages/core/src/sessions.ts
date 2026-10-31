import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { open } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

const run = promisify(execFile);

// The agent session store: the SQLite file `agent_session` writes, one
// record per session with the topic it served, TOPIC_OVERVIEW_SESSIONS in
// .env. A leading ~ stands for the home directory. Without it, nothing is
// known of a topic's sessions, and the page shows none.
export function sessionsStore(): string | undefined {
  const configured = process.env.TOPIC_OVERVIEW_SESSIONS;
  if (!configured) return undefined;
  return configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
}

// A Claude session: its id, and the transcript Claude Code writes for it.
export interface Session {
  id: string;
  transcript: string;
}

// Claude Code keeps a session's transcript as `<id>.jsonl` in a folder named
// after the directory the session runs in. The transcript is looked up by its
// id, so it is found wherever the command is run from; the folder of the
// directory given is the fallback, for a session whose transcript is not
// written yet.
export function claudeSession(id: string, cwd: string = process.cwd(), projects = join(homedir(), ".claude/projects")): Session {
  const file = `${id}.jsonl`;
  const folders = existsSync(projects) ? readdirSync(projects) : [];
  const found = folders.find((folder) => existsSync(join(projects, folder, file)));
  const folder = found ?? cwd.replace(/[^A-Za-z0-9]/g, "-");
  return { id, transcript: join(projects, folder, file) };
}

// The sessions that served a topic, read off the store: every record with
// the topic's key, each with what its transcript says, when it started and
// was last used and its first prompt, and whether it runs now, read off the
// tmux windows the way the discussion's agent is. One-shots, started as
// sdk-cli, are not sessions to resume or build on, so they are counted and
// spanned rather than listed, as `agent_session list` closes its listing.
export interface SessionRecord {
  agent: string;
  id: string;
  directory: string;
  entrypoint: string;
  topic: string;
  title: string;
  note: string;
}

export type RunningState = "busy" | "waiting" | "idle";

export interface TopicSession {
  agent: string;
  id: string;
  directory: string;
  title: string;
  note?: string;
  prompt?: string; // the first prompt, standing in for a note
  started?: string; // ISO; none when the transcript is gone
  used?: string;
  running?: { window: string; state: RunningState }; // the tmux window it runs in
}

export interface OneShots {
  count: number;
  from?: string; // ISO, the earliest start
  to?: string; // ISO, the latest use
}

export interface TopicSessions {
  sessions: TopicSession[]; // oldest first
  oneShots: OneShots;
}

export function readRecords(store: string, key: string): SessionRecord[] {
  const database = new DatabaseSync(store, { readOnly: true });
  try {
    const rows = database
      .prepare("SELECT agent, id, directory, entrypoint, topic, title, note FROM sessions WHERE topic = ? ORDER BY rowid")
      .all(key) as unknown as SessionRecord[];
    return rows;
  } finally {
    database.close();
  }
}

// Where an agent keeps a record's transcript: Claude Code under the project
// folder of the directory, or wherever the id is found; pi under its own
// folders, found by the id's suffix. Nothing when it is gone.
export function transcriptOf(record: SessionRecord, projects = join(homedir(), ".claude/projects"), pi = join(homedir(), ".pi/agent/sessions")): string | undefined {
  if (record.agent === "claude") {
    const path = claudeSession(record.id, record.directory, projects).transcript;
    return existsSync(path) ? path : undefined;
  }
  if (record.agent === "pi" && existsSync(pi)) {
    for (const folder of readdirSync(pi)) {
      const files = existsSync(join(pi, folder)) ? readdirSync(join(pi, folder)) : [];
      const found = files.find((file) => file.endsWith(`_${record.id}.jsonl`));
      if (found) return join(pi, folder, found);
    }
  }
  return undefined;
}

export interface TranscriptFacts {
  started?: string;
  used?: string;
  prompt?: string;
}

const CHUNK = 64 * 1024;

// The first and the last timestamps in a transcript, and the first thing the
// user said, read from the file's head and tail, never the whole of it: a
// transcript runs to a hundred megabytes, and the facts sit at its ends.
export async function transcriptFacts(path: string): Promise<TranscriptFacts> {
  const facts: TranscriptFacts = {};
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();
    // The tail, chunk by chunk backwards until a timestamp is found: the
    // last lines can be request blobs longer than a chunk, stamped or not.
    let end = size;
    while (end > 0 && facts.used === undefined) {
      const tail = Buffer.alloc(Math.min(CHUNK, end));
      await handle.read(tail, 0, tail.length, end - tail.length);
      end -= tail.length;
      const stamps = tail.toString("utf8").match(/"timestamp":"([^"]+)"/g);
      if (stamps) facts.used = stamps[stamps.length - 1].slice(13, -1);
    }
    // The head, chunk by chunk until the first timestamp and the first prompt
    // are both found, which is almost always within the first chunk.
    let read = 0;
    let rest = "";
    while (read < size && (facts.started === undefined || facts.prompt === undefined)) {
      const chunk = Buffer.alloc(Math.min(CHUNK, size - read));
      await handle.read(chunk, 0, chunk.length, read);
      read += chunk.length;
      const lines = (rest + chunk.toString("utf8")).split("\n");
      rest = read < size ? (lines.pop() ?? "") : "";
      for (const line of lines) {
        if (facts.started === undefined) {
          const stamp = /"timestamp":"([^"]+)"/.exec(line);
          if (stamp) facts.started = stamp[1];
        }
        if (facts.prompt === undefined && line.includes('"user"')) {
          const prompt = firstPrompt(line);
          if (prompt !== undefined) facts.prompt = prompt;
        }
        if (facts.started !== undefined && facts.prompt !== undefined) break;
      }
    }
  } finally {
    await handle.close();
  }
  return facts;
}

// The user's text in a transcript line, when the line is a user turn: a
// string or text blocks for Claude Code, a message with the role user for
// pi. Tags are dropped and the text cut to one line, as the listing shows it.
export function firstPrompt(line: string): string | undefined {
  let parsed: { type?: string; isMeta?: boolean; message?: { role?: string; content?: unknown } };
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (parsed.isMeta) return undefined;
  const user = parsed.type === "user" || (parsed.type === "message" && parsed.message?.role === "user");
  if (!user) return undefined;
  const content = parsed.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .filter((block): block is { type: "text"; text: string } => typeof block === "object" && block !== null && (block as { type?: string }).type === "text")
            .map((block) => block.text)
            .join(" ")
        : "";
  const flat = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return undefined;
  return flat.length > 80 ? flat.slice(0, 80) : flat;
}

// Which sessions run now: every tmux window where Claude runs, with the
// transcript its hooks left there and the state the status bar marks, by
// the transcript's id. Without tmux, nothing runs.
export async function runningSessions(): Promise<Map<string, { window: string; state: RunningState }>> {
  const running = new Map<string, { window: string; state: RunningState }>();
  const format = "#{session_name}:#{window_name}\t#{@claude_transcript}\t#{@window_state}\t#{pane_current_command}";
  const { stdout } = await run("tmux", ["list-panes", "-a", "-F", format]).catch(() => ({ stdout: "" }));
  for (const line of stdout.split("\n")) {
    const [window, transcript, state, command] = line.split("\t");
    if (!transcript || command !== "claude") continue;
    const id = basename(transcript, ".jsonl");
    running.set(id, { window, state: state === "busy" || state === "waiting" ? state : "idle" });
  }
  return running;
}

export async function topicSessions(key: string, store: string | undefined = sessionsStore()): Promise<TopicSessions | undefined> {
  if (!store || !existsSync(store)) return undefined;
  const records = readRecords(store, key);
  const running = await runningSessions();
  const sessions: TopicSession[] = [];
  const oneShots: OneShots = { count: 0 };
  for (const record of records) {
    const transcript = transcriptOf(record);
    const facts = transcript ? await transcriptFacts(transcript) : {};
    if (record.entrypoint === "sdk-cli") {
      oneShots.count += 1;
      if (facts.started && (!oneShots.from || facts.started < oneShots.from)) oneShots.from = facts.started;
      if (facts.used && (!oneShots.to || facts.used > oneShots.to)) oneShots.to = facts.used;
      continue;
    }
    const session: TopicSession = { agent: record.agent, id: record.id, directory: record.directory, title: record.title };
    if (record.note) session.note = record.note;
    if (facts.prompt) session.prompt = facts.prompt;
    if (facts.started) session.started = facts.started;
    if (facts.used) session.used = facts.used;
    const runs = running.get(record.id);
    if (runs) session.running = runs;
    sessions.push(session);
  }
  sessions.sort((a, b) => (a.started ?? "").localeCompare(b.started ?? ""));
  return { sessions, oneShots };
}

// One record, by its id, whatever its agent: ids are unique across agents
// in practice, and a listing names a session by its id alone.
export function readRecord(store: string, id: string): SessionRecord | undefined {
  const database = new DatabaseSync(store, { readOnly: true });
  try {
    const row = database.prepare("SELECT agent, id, directory, entrypoint, topic, title, note FROM sessions WHERE id = ?").get(id);
    return row as unknown as SessionRecord | undefined;
  } finally {
    database.close();
  }
}

// The repositories a task page names under Source Repository, most
// significant first, in either of its two forms: on the field's own line,
// or as the entries nested under it. An entry is taken up to the first
// space, which is where a branch or a descriptor would follow.
export function sourceRepositories(text: string): string[] {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.includes("**Source Repository**:"));
  if (at === -1) return [];
  const inline = lines[at].replace(/^.*\*\*Source Repository\*\*:\s*/, "").trim();
  if (inline) return [inline.split(/\s/)[0]];
  const depth = lines[at].match(/^\t*/)![0].length;
  const found: string[] = [];
  for (const line of lines.slice(at + 1)) {
    const indent = line.match(/^\t*/)![0].length;
    if (!line.trim() || indent <= depth) break;
    const entry = line.replace(/^\t*-\s*/, "").trim();
    if (entry) found.push(entry.split(/\s/)[0]);
  }
  return found;
}

// Where a repository the page names is on disk: a path as written, ~
// standing for home, or a name under ~/Developer/src. Nothing when neither
// exists.
export function repositoryPath(entry: string, src = join(homedir(), "Developer/src")): string | undefined {
  const path = entry.startsWith("~/") ? join(homedir(), entry.slice(2)) : entry.startsWith("/") ? entry : join(src, entry);
  return existsSync(path) ? path : undefined;
}

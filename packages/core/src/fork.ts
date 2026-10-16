// A fork of the discussion's main Claude session, answering a question
// while the main agent is busy: `claude -p --resume <main> --fork-session`
// copies the main session's conversation as it stands into a session of its
// own, with its own transcript, and answers there. A follow-up resumes that
// fork rather than forking again. The fork reads and never writes: the main
// agent is the discussion's one writer, and a fork editing the source or
// running commands in the middle of its turn would break that.

import { execFile } from "node:child_process";
import { open } from "node:fs/promises";
import { promisify } from "node:util";

import { StoreError } from "./store.ts";

const run = promisify(execFile);

// How long a fork may take to answer. A question is a lookup, not work.
const TIMEOUT = 180_000;
// What the fork may do: read, and nothing else.
const ALLOWED = "Read,Glob,Grep";
const DISALLOWED = "Edit,Write,MultiEdit,NotebookEdit,Bash,Agent";
// What the fork is told ahead of the question, since no skill tells it.
const FRAME = "A question from the discussion's page, answered by a fork of the main session with reading tools only. Answer in short, plain Markdown: ";

export interface ForkOptions {
  from: string; // the session to start from: the main one, or the fork for a follow-up
  resume?: boolean; // continue `from` itself rather than fork it
  session?: string; // the id the fork gets, when forking; chosen ahead, so the question knows it at once
  prompt: string;
  model?: string; // the fork's model; the main session's when not given
  cwd?: string; // where the fork runs: the main session's directory, so Claude Code files it with that project
}

export interface ForkAnswer {
  session: string; // the fork's own session id
  answer: string;
  failed: boolean;
  duration?: number; // milliseconds, as Claude Code reports it
}

// The arguments `claude` is run with. The prompt follows -p at once, since
// the tool lists would otherwise take it for one of theirs.
export function forkArguments(options: ForkOptions): string[] {
  const args = ["-p", `${FRAME}${options.prompt}`, "--output-format", "json", "--resume", options.from];
  if (!options.resume) {
    args.push("--fork-session");
    if (options.session) args.push("--session-id", options.session);
  }
  args.push("--allowedTools", ALLOWED, "--disallowedTools", DISALLOWED);
  if (options.model) args.push("--model", options.model);
  return args;
}

// What `claude -p --output-format json` printed, read as the answer.
export function parseForkOutput(output: string): ForkAnswer {
  let parsed: { session_id?: unknown; result?: unknown; is_error?: unknown; duration_ms?: unknown };
  try {
    parsed = JSON.parse(output) as typeof parsed;
  } catch {
    throw new StoreError(`the fork answered with no JSON: ${output.trim().slice(0, 200)}`);
  }
  if (typeof parsed.session_id !== "string") throw new StoreError("the fork's answer names no session");
  return {
    session: parsed.session_id,
    answer: typeof parsed.result === "string" ? parsed.result : "",
    failed: parsed.is_error === true,
    ...(typeof parsed.duration_ms === "number" ? { duration: parsed.duration_ms } : {}),
  };
}

export async function fork(options: ForkOptions): Promise<ForkAnswer> {
  const { stdout } = await run("claude", forkArguments(options), { cwd: options.cwd, timeout: TIMEOUT, maxBuffer: 16 * 1024 * 1024 });
  return parseForkOutput(stdout);
}

// The directory a session runs in, as its transcript records it on every
// entry of the conversation; none when the transcript says nothing.
export async function sessionDirectory(transcript: string): Promise<string | undefined> {
  let handle;
  try {
    handle = await open(transcript, "r");
  } catch {
    return undefined;
  }
  try {
    for await (const line of handle.readLines()) {
      const match = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(line);
      if (match) return JSON.parse(`"${match[1]}"`) as string;
    }
  } finally {
    await handle.close();
  }
  return undefined;
}

// The fork's model, TOPIC_OVERVIEW_FORK_MODEL in .env; none means the main
// session's.
export function forkModel(): string | undefined {
  return process.env.TOPIC_OVERVIEW_FORK_MODEL || undefined;
}

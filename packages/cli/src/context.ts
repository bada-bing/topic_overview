import { type DiscussionRef, type Place, type SessionInfo, Store, StoreError, claudeSession } from "@topic-overview/core";

const PAGE_URL = "http://127.0.0.1:5173/d";

export interface Context {
  store: Store;
  session?: SessionInfo;
  from?: number; // the version a copy was made from
  label?: string; // a name to show for what is added
  place?: { place: Place; address: string }; // where a block goes: --after, --before or --into a block
  line?: { line: number; text: string }; // a block without an id: its line and its first line
  nil?: boolean; // a property removed rather than set
}

// pnpm runs the command from the repository, and keeps the directory it was
// called from in INIT_CWD; the session's transcript lives under that one.
export function context(
  sessionId: string | undefined,
  from: string | undefined,
  label?: string,
  places: Partial<Record<Place, string>> = {},
  at: { line?: string; text?: string; nil?: boolean } = {},
): Context {
  const store = new Store();
  const session = sessionId ? claudeSession(sessionId, process.env.INIT_CWD ?? process.cwd()) : undefined;
  const given = (Object.entries(places) as [Place, string | undefined][]).filter(([, address]) => address !== undefined);
  if (given.length > 1) throw new StoreError("give one of --after, --before and --into");
  const place = given[0] ? { place: given[0][0], address: given[0][1]! } : undefined;
  if ((at.line === undefined) !== (at.text === undefined)) throw new StoreError("give both --line and --text");
  const line = at.line === undefined ? undefined : { line: Number(at.line), text: at.text! };
  if (line && !Number.isInteger(line.line)) throw new StoreError("--line takes a line number");
  return { store, session, label, place, line, nil: at.nil, from: from === undefined ? undefined : Number(from) };
}

// A block given to be written, read from stdin.
export async function readBlock(usage: string): Promise<string> {
  if (process.stdin.isTTY) throw new StoreError(`usage: ${usage}, with the block on stdin`);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function needLine(context: Context, usage: string): { line: number; text: string } {
  if (!context.line) throw new StoreError(`usage: ${usage}`);
  return context.line;
}

export function needPlace(context: Context, usage: string): { place: Place; address: string } {
  if (!context.place) throw new StoreError(`usage: ${usage}`);
  return context.place;
}

export function url(ref: DiscussionRef): string {
  return `${PAGE_URL}/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.startedAt)}`;
}

export function topicUrl(key: string): string {
  return `${PAGE_URL}/${encodeURIComponent(key)}`;
}

export function need<T>(value: T | undefined, usage: string): T {
  if (value === undefined) throw new StoreError(`usage: ${usage}`);
  return value;
}

export async function openDiscussion(context: Context, source: string): Promise<DiscussionRef> {
  const ref = await context.store.openDiscussionOf(source);
  if (!ref) throw new StoreError(`there is no open discussion of ${source}`);
  return ref;
}

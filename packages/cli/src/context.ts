import { type DiscussionRef, type SessionInfo, Store, StoreError, claudeSession } from "@topic-overview/core";

const PAGE_URL = "http://127.0.0.1:5173/d";

export interface Context {
  store: Store;
  session?: SessionInfo;
  from?: number; // the version a copy was made from
}

// pnpm runs the command from the repository, and keeps the directory it was
// called from in INIT_CWD; the session's transcript lives under that one.
export function context(sessionId: string | undefined, from: string | undefined): Context {
  const store = new Store();
  const session = sessionId ? claudeSession(sessionId, process.env.INIT_CWD ?? process.cwd()) : undefined;
  return { store, session, from: from === undefined ? undefined : Number(from) };
}

export function url(ref: DiscussionRef): string {
  return `${PAGE_URL}/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.startedAt)}`;
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

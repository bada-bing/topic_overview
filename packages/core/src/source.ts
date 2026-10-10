// A discussion's source as a file on disk: read, fingerprinted and copied.
// The fingerprint tells a real change from a file merely written again.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { convertLogseq } from "./logseq.ts";
import type { DiscussionRef, SessionInfo, Store } from "./store.ts";

export function fingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Opens a discussion on a copy of a Logseq page, closing the one still open
// on the same source. A discussion refreshed from its source carries the
// sessions of the one it replaces, since they work on the same topic.
export async function openOnLogseqPage(
  store: Store,
  source: string,
  path: string,
  session?: SessionInfo,
  carried: SessionInfo[] = [],
): Promise<DiscussionRef> {
  const text = await readFile(path, "utf8");
  return store.open(source, path, convertLogseq(text), session, new Date(), fingerprint(text), carried);
}

// Whether the source differs from the copy a discussion was opened on. A
// discussion opened before fingerprints were kept counts every write as a
// change.
export async function sourceChanged(path: string, hash: string | undefined): Promise<boolean> {
  const text = await readFile(path, "utf8").catch(() => undefined);
  if (text === undefined) return true;
  return hash === undefined || fingerprint(text) !== hash;
}

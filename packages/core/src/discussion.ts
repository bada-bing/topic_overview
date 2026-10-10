// discussion.json: everything about a discussion except its content and its
// attachments. The annotations start empty with every new version.

export interface Session {
  id: string;
  transcript: string;
}

export interface Annotation {
  id: string;
  type: "comment";
  target: string; // a block id
  author: string;
  time: string;
  body: string;
}

// Why a discussion was closed. A discussion closed before reasons were kept
// has none.
export type Resolution = "on-demand" | "source-changed" | "started-over";

const RESOLUTIONS: Record<Resolution, string> = {
  "on-demand": "on demand",
  "source-changed": "source changed",
  "started-over": "started over",
};

// How a discussion's state reads: open, closed, or closed for a reason.
export function stateText(discussion: { closed: string | null; resolution?: Resolution }): string {
  if (!discussion.closed) return "open";
  return discussion.resolution ? `closed (${RESOLUTIONS[discussion.resolution]})` : "closed";
}

export interface Discussion {
  source: string; // where the copy came from, such as a Logseq page's path
  sourceHash?: string; // the SHA-256 of the source as it was copied
  opened: string;
  closed: string | null;
  resolution?: Resolution; // why it was closed
  version: number;
  sessions: Session[];
  annotations: Annotation[];
}

export function newDiscussion(source: string, opened: string): Discussion {
  return { source, opened, closed: null, version: 1, sessions: [], annotations: [] };
}

export function serializeDiscussion(discussion: Discussion): string {
  return JSON.stringify(discussion, null, 2) + "\n";
}

export function parseDiscussion(text: string): Discussion {
  return JSON.parse(text) as Discussion;
}

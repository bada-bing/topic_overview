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

export interface Discussion {
  source: string; // where the copy came from, such as a Logseq page's path
  opened: string;
  closed: string | null;
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

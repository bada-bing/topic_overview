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

// Something a discussion depends on outside its source, named after the
// system that is asked about it. A merge request is read off the page's
// Links; the others are added by the agent.
export const INTEGRATION_KINDS = ["merge-request", "local", "cluster", "jenkins", "browser"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export interface Integration {
  id: string;
  kind: IntegrationKind;
  reference: string; // what the system knows it by, such as project:process
  label?: string;
  detail?: string; // what the page says of it, such as what a merge request does
  tab?: Tab; // a browser page's tab, once the view opened it
}

// The tab the view opened a browser page in, and how to reach it over the
// Chrome DevTools Protocol: the browser's endpoint, and the tab's own
// WebSocket, which a client attaches to in order to control the page.
export interface Tab {
  id: string;
  endpoint: string; // such as http://127.0.0.1:9223
  webSocket: string; // such as ws://127.0.0.1:9223/devtools/page/<id>
}

export interface Discussion {
  source: string; // where the copy came from, such as a Logseq page's path
  sourceHash?: string; // the SHA-256 of the source as it was copied
  opened: string;
  closed: string | null;
  resolution?: Resolution; // why it was closed
  version: number;
  sessions: Session[];
  integrations?: Integration[]; // survive every version, unlike annotations
  annotations: Annotation[];
}

export function newDiscussion(source: string, opened: string): Discussion {
  return { source, opened, closed: null, version: 1, sessions: [], integrations: [], annotations: [] };
}

export function serializeDiscussion(discussion: Discussion): string {
  return JSON.stringify(discussion, null, 2) + "\n";
}

export function parseDiscussion(text: string): Discussion {
  return JSON.parse(text) as Discussion;
}

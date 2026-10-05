// The shapes the server sends. They mirror server/page.ts and
// server/discussion.ts.

export interface Block {
  id: string;
  kind: "heading" | "block";
  level?: number;
  text: string;
  properties: Record<string, string>;
  children: Block[];
}

export interface DiscussionView {
  ref: { source: string; startedAt: string };
  discussion: { source: string; opened: string; closed: string | null; version: number };
  page: { frontmatter: string; blocks: Block[] };
}

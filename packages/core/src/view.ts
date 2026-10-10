// What the server sends the page for one discussion.

import type { Attachment } from "./attachments.ts";
import type { Discussion } from "./discussion.ts";
import type { Page } from "./page.ts";
import type { DiscussionRef } from "./store.ts";

export interface DiscussionView {
  ref: DiscussionRef;
  discussion: Discussion;
  page: Page;
  attachments: Attachment[];
  earlier: EarlierDiscussion[]; // the other discussions of the same source, oldest first
}

export interface EarlierDiscussion {
  startedAt: string;
  version: number;
  closed: string | null;
}

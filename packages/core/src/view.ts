// What the server sends the page for one discussion.

import type { Attachment } from "./attachments.ts";
import type { Discussion, Resolution } from "./discussion.ts";
import type { Page, SourceProblem } from "./page.ts";
import type { Mark } from "./mark.ts";
import type { Question } from "./question.ts";
import type { DiscussionRef } from "./store.ts";

export interface DiscussionView {
  ref: DiscussionRef;
  discussion: Discussion;
  page: Page;
  attachments: Attachment[];
  earlier: EarlierDiscussion[]; // the other discussions of the same source, oldest first
  branch?: string; // the branch a discussion on the source itself is on
  worktree?: string; // where that branch is checked out
  problems?: SourceProblem[]; // what the page cannot render of its source, each with the reason
  marks?: Mark[]; // the blocks the agent changed that I have not confirmed seeing
  conflict?: string[]; // the files a merge from main stopped on, until it is resolved
  questions?: Question[]; // what I asked the agent about blocks, until I dismiss it
}

export interface EarlierDiscussion {
  startedAt: string;
  version: number;
  closed: string | null;
  resolution?: Resolution;
}

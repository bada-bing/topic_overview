// What the server sends the page for one discussion.

import type { ElsewhereBlock } from "./elsewhere.ts";
import type { Integration } from "./integration.ts";
import type { Mark } from "./mark.ts";
import type { Page, SourceProblem } from "./page.ts";
import type { Question } from "./question.ts";
import type { Session } from "./sessions.ts";

export interface DiscussionView {
  key: string;
  source: string; // the page, relative to the knowledge base
  branch: string;
  worktree: string; // where the branch is checked out
  opened: string;
  session?: Session; // the Claude session recorded when the discussion was opened
  integrations: Integration[];
  page: Page;
  problems: SourceProblem[]; // what the page cannot render of its source, each with the reason
  elsewhere: Record<string, ElsewhereBlock>; // the blocks the page refers to on other pages, by id
  marks: Mark[]; // the blocks the agent changed that I have not confirmed seeing
  conflict?: string[]; // the files a merge from main stopped on, until it is resolved
  questions: Question[]; // what I asked the agent, until I dismiss it
}

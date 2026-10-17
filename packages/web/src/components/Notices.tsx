import { For } from "solid-js";

import type { Work } from "@topic-overview/core";
import type { TranscriptEntry } from "@topic-overview/core/transcript";

import { Banner } from "./Banner.tsx";

// A change from outside, as the server tells it.
export type Change =
  | { kind: "source" } // the source changed in the worktree; the page fetches it again
  | { kind: "linked"; page: string; message: string }
  | { kind: "asset"; file: string } // a file of the KB's assets/ the source links to
  | { kind: "info"; message: string; files?: string[] } // files: what an update from main changed that matters here
  | { kind: "integration"; state: { id: string; state: string; detail?: string; url?: string; environment?: string; name?: string } }
  | { kind: "agent"; state: "busy" | "waiting" | "idle" | "gone"; name?: string } // what the discussion's agent is doing, and where
  | { kind: "conflict"; files: string[] } // the files a merge from main stopped on; none once resolved
  | { kind: "transcript"; entries: TranscriptEntry[]; replace: boolean } // what the agent's transcript holds: all of it anew, or what a write added
  | { kind: "work"; work: Work | undefined }; // the active work: what is being recorded, and for how long

export interface Notice {
  id: number;
  change: Extract<Change, { kind: "linked" | "info" }>;
}

// Changes that are information: a linked page that changed, or something a
// side announced. They stay until dismissed, and never cover the page.
export function Notices(props: {
  notices: Notice[];
  shownBeside: string | undefined;
  onShowAgain: (page: string) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <For each={props.notices}>
        {(notice) => (
          <Banner onDismiss={() => props.onDismiss(notice.id)}>
            <span>
              {notice.change.message}
              {"files" in notice.change && notice.change.files ? (
                <ul class="notice-files">
                  <For each={notice.change.files}>{(file) => <li>{file}</li>}</For>
                </ul>
              ) : null}
            </span>
            {notice.change.kind === "linked" && notice.change.page === props.shownBeside ? (
              <button type="button" onClick={() => props.onShowAgain((notice.change as { page: string }).page)}>
                Show it again
              </button>
            ) : null}
          </Banner>
        )}
    </For>
  );
}

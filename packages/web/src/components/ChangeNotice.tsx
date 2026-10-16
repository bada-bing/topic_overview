import { Show, createSignal } from "solid-js";

import type { TranscriptEntry } from "@topic-overview/core/transcript";

import { readAnswer } from "../http.ts";
import { Banner } from "./Banner.tsx";
import { For } from "solid-js";

// A change from outside, as the server tells it. A change to the
// discussion's own content blocks the page; the others are information.
export type Change =
  | { kind: "source"; message: string }
  | { kind: "version"; message: string }
  | { kind: "linked"; page: string; message: string }
  | { kind: "asset"; file: string } // a file of the KB's assets/ the source links to
  | { kind: "info"; message: string; files?: string[] } // files: what an update from main changed that matters here
  | { kind: "integration"; state: { id: string; state: string; detail?: string; url?: string; environment?: string; name?: string } }
  | { kind: "agent"; state: "busy" | "waiting" | "idle" | "gone"; name?: string } // what the discussion's agent is doing, and where
  | { kind: "conflict"; files: string[] } // the files a merge from main stopped on; none once resolved
  | { kind: "transcript"; entries: TranscriptEntry[]; replace: boolean }; // what the agent's transcript holds: all of it anew, or what a write added

// Only a changed source blocks the page: what it shows is out of date, and
// the way out is refreshing the discussion from its source. A new version is
// shown at once instead.
export type BlockingChange = Extract<Change, { kind: "source" }>;

export function isBlocking(change: Change): change is BlockingChange {
  return change.kind === "source";
}

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

// A changed source. It covers the page and allows only refreshing the
// discussion from its source, so no time goes into content that is already
// out of date.
export function ChangeNotice(props: { change: BlockingChange; base: string }) {
  const [failure, setFailure] = createSignal<string | undefined>(undefined);
  const refresh = async () => {
    try {
      const body = await readAnswer<{ ref: { source: string; startedAt: string } }>(
        await fetch(`${props.base}/refresh`, { method: "POST" }),
      );
      location.assign(`/d/${encodeURIComponent(body.ref.source)}/${encodeURIComponent(body.ref.startedAt)}`);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div class="change-overlay" role="alertdialog" aria-modal="true">
      <div class="change-notice">
        <p>{props.change.message}</p>
        <p class="change-consequence">
          The page is copied again from the source as it is now. Comments made so far stay in the history of the copy
          they were made on.
        </p>
        <button type="button" onClick={() => void refresh()}>
          Refresh from the source
        </button>
        <Show when={failure()}>
          <p class="error">{failure()}</p>
        </Show>
      </div>
    </div>
  );
}

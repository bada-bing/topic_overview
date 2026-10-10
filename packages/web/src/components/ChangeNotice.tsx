import { Show, createSignal } from "solid-js";

import { readAnswer } from "../http.ts";
import { For } from "solid-js";

// A change from outside, as the server tells it. A change to the
// discussion's own content blocks the page; the others are information.
export type Change =
  | { kind: "source"; message: string }
  | { kind: "version"; message: string }
  | { kind: "linked"; page: string; message: string }
  | { kind: "info"; message: string }
  | { kind: "integration"; state: { id: string; state: string; detail?: string } };

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
    <div class="notices">
      <For each={props.notices}>
        {(notice) => (
          <div class="notice">
            <span>{notice.change.message}</span>
            {notice.change.kind === "linked" && notice.change.page === props.shownBeside ? (
              <button type="button" onClick={() => props.onShowAgain((notice.change as { page: string }).page)}>
                Show it again
              </button>
            ) : null}
            <button type="button" class="notice-dismiss" title="Dismiss" onClick={() => props.onDismiss(notice.id)}>
              ×
            </button>
          </div>
        )}
      </For>
    </div>
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

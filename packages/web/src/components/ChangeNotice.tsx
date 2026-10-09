import { Show, createSignal } from "solid-js";
import { For } from "solid-js";

// A change from outside, as the server tells it. A change to the
// discussion's own content blocks the page; the others are information.
export type Change =
  | { kind: "source"; message: string }
  | { kind: "version"; message: string }
  | { kind: "linked"; page: string; message: string }
  | { kind: "info"; message: string };

export type BlockingChange = Extract<Change, { kind: "source" | "version" }>;

export function isBlocking(change: Change): change is BlockingChange {
  return change.kind === "source" || change.kind === "version";
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

// What changed while the page was open. It covers the page and allows only
// reloading, so no time goes into content that is already out of date.
export function ChangeNotice(props: { change: BlockingChange; base: string }) {
  const [failure, setFailure] = createSignal<string | undefined>(undefined);
  const reload = async () => {
    if (props.change.kind === "version") return location.reload();
    try {
      const response = await fetch(`${props.base}/reopen`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`);
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
          {props.change.kind === "source"
            ? "Reloading closes this discussion and opens a new one on the source as it is now."
            : "Reloading shows the new version."}
        </p>
        <button type="button" onClick={() => void reload()}>
          Reload
        </button>
        <Show when={failure()}>
          <p class="error">{failure()}</p>
        </Show>
      </div>
    </div>
  );
}

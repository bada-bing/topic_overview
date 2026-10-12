import { Show, createSignal } from "solid-js";

// A field for writing a comment or a block's text. Ctrl or Cmd with Enter
// saves it, Escape cancels it.
export function TextField(props: { initial?: string; action?: string; onSave: (body: string) => Promise<void>; onCancel: () => void }) {
  const [error, setError] = createSignal<string | undefined>(undefined);
  let field: HTMLTextAreaElement | undefined;
  const save = () => {
    const body = field?.value.trim() ?? "";
    if (!body) return;
    props.onSave(body).catch((failure: unknown) => setError(String(failure)));
  };
  return (
    <div class="comment-field">
      <textarea
        ref={(element) => {
          field = element;
          queueMicrotask(() => element.focus());
        }}
        rows={3}
        value={props.initial ?? ""}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
          if (event.key === "Escape") props.onCancel();
        }}
      />
      <div class="comment-field-actions">
        <button type="button" onClick={save}>
          {props.action ?? "Save"}
        </button>
        <button type="button" onClick={() => props.onCancel()}>
          Cancel
        </button>
        <Show when={error()}>
          <span class="error">{error()}</span>
        </Show>
      </div>
    </div>
  );
}

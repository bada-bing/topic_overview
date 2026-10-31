import { Show, createSignal } from "solid-js";

// A field for writing a question or a block's text. Ctrl or Cmd
// with Enter saves it, Escape cancels it. A second action, such as asking a
// fork rather than the agent, is a second button, and Shift with the keys.
// A field whose text is optional, such as a note to a do, saves empty too.
export function TextField(props: {
  initial?: string;
  action?: string;
  optional?: boolean;
  placeholder?: string;
  blocked?: string; // why the action cannot be taken now, which disables its button
  onSave: (body: string) => Promise<void>;
  secondary?: { action: string; title?: string; onSave: (body: string) => Promise<void> };
  onCancel: () => void;
}) {
  const [error, setError] = createSignal<string | undefined>(undefined);
  let field: HTMLTextAreaElement | undefined;
  const submit = (to: (body: string) => Promise<void>) => {
    const body = field?.value.trim() ?? "";
    if (!body && !props.optional) return;
    to(body).catch((failure: unknown) => setError(String(failure)));
  };
  const save = () => {
    if (props.blocked === undefined) submit(props.onSave);
  };
  return (
    <div class="text-field">
      <textarea
        ref={(element) => {
          field = element;
          queueMicrotask(() => element.focus());
        }}
        rows={3}
        value={props.initial ?? ""}
        placeholder={props.placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            if (event.shiftKey && props.secondary) submit(props.secondary.onSave);
            else save();
          }
          if (event.key === "Escape") props.onCancel();
        }}
      />
      <div class="text-field-actions">
        <button type="button" disabled={props.blocked !== undefined} title={props.blocked} onClick={save}>
          {props.action ?? "Save"}
        </button>
        <Show when={props.secondary}>
          {(secondary) => (
            <button type="button" title={secondary().title} onClick={() => submit(secondary().onSave)}>
              {secondary().action}
            </button>
          )}
        </Show>
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

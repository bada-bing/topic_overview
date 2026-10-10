import { Show, createSignal, onSettled } from "solid-js";

import { readAnswer } from "../http.ts";

export const MERGE_REQUEST = /\/-\/merge_requests\/\d+\/?$/;

interface State {
  state: "opened" | "merged" | "closed" | "locked";
  draft: boolean;
}

// A link to a merge request, with its state as a badge. A host the server is
// not configured to ask shows no badge; one that does not answer shows "?".
export function MergeRequestLink(props: { href: string; text: string }) {
  const [state, setState] = createSignal<State | undefined>(undefined);
  const [unknown, setUnknown] = createSignal(false);
  onSettled(() => {
    fetch(`/api/merge-request?url=${encodeURIComponent(props.href)}`)
      .then((response) => {
        if (response.status === 404) return undefined;
        return readAnswer<State>(response);
      })
      .then((answer) => answer && setState(answer))
      .catch(() => setUnknown(true));
  });
  const label = () => {
    const shown = state();
    if (!shown) return "";
    return shown.state === "opened" ? (shown.draft ? "draft" : "open") : shown.state;
  };
  return (
    <>
      <a href={props.href} target="_blank" rel="noreferrer">
        {props.text}
      </a>
      <Show when={state()}>
        <span class={["merge-request-state", `merge-request-${label()}`]}>{label()}</span>
      </Show>
      <Show when={unknown()}>
        <span class="merge-request-state" title="GitLab did not answer">
          ?
        </span>
      </Show>
    </>
  );
}

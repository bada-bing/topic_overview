import type { JSX } from "@solidjs/web";

// One banner in the corner of the page, the shape every notice takes: what it
// says, and a button that dismisses it. A problem is marked as one, since it
// says something is wrong rather than that something happened.
export function Banner(props: { problem?: boolean; onDismiss: () => void; children: JSX.Element }) {
  return (
    <div class={["notice", { "notice-problem": !!props.problem }]} role={props.problem ? "alert" : undefined}>
      <div class="notice-body">{props.children}</div>
      <button type="button" class="notice-dismiss" title="Dismiss" onClick={() => props.onDismiss()}>
        ×
      </button>
    </div>
  );
}

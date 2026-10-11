import { Show, createSignal } from "solid-js";

import { Banner } from "./Banner.tsx";

// Merging main stopped on a conflict: which files, and that it is resolved
// in the terminal, where the merge is finished or aborted. Until then nothing
// is edited. Dismissing it hides it until the conflict changes.
export function ConflictBanner(props: { files: string[] }) {
  const [dismissed, setDismissed] = createSignal<string | undefined>(undefined);
  const shown = () => props.files.length > 0 && dismissed() !== props.files.join("\n");
  return (
    <Show when={shown()}>
      <Banner problem onDismiss={() => setDismissed(props.files.join("\n"))}>
        <strong>Merging main stopped on a conflict</strong>
        <p class="source-problem">
          {props.files.join(", ")}
          <span class="source-problem-reason">Resolve it in the terminal, or abort the merge; nothing is edited until then.</span>
        </p>
      </Banner>
    </Show>
  );
}

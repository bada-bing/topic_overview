import { For, Show, createSignal } from "solid-js";

import type { SourceProblem } from "@topic-overview/core/page";

import { Banner } from "./Banner.tsx";

// The key a problem is pointed at by, which relates it to its block.
export function problemKey(index: number): string {
  return `problem:${index}`;
}

// A banner of what the page cannot render of its source. Each entry is a link
// to the block where it appears: clicking it opens the block's section and
// brings the block into view, and pointing at it tints the block, so a
// mistake in the source shows rather than being rendered wrong. Dismissing it
// hides it until the page is loaded again, which a change to the source does.
export function SourceProblems(props: { problems: SourceProblem[] }) {
  const [dismissed, setDismissed] = createSignal(false);
  return (
    <Show when={props.problems.length > 0 && !dismissed()}>
      <Banner problem onDismiss={() => setDismissed(true)}>
        <strong>Cannot be rendered ({props.problems.length})</strong>
        <For each={props.problems}>
          {(problem, index) => (
            <a class="source-problem" href={`#${problem.block}`} data-block={problemKey(index())}>
              <span class="source-problem-excerpt">{problem.excerpt}</span>
              <span class="source-problem-reason">{problem.reason}</span>
            </a>
          )}
        </For>
      </Banner>
    </Show>
  );
}

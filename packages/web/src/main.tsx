import { render } from "@solidjs/web";
import { Errored, For, Loading, Show, createMemo, createSignal, flush, onSettled } from "solid-js";

import type { DiscussionView } from "@topic-overview/core";

import { Blocks } from "./components/Blocks.tsx";
import { Outline } from "./components/Outline.tsx";
import { Section } from "./components/Section.tsx";
import { isSection, outline, sectionOf } from "./outline.ts";
import "./style.css";

const ROUTE = /^\/d\/([^/]+)\/([^/]+)\/?$/;

async function fetchDiscussion(source: string, startedAt: string): Promise<DiscussionView> {
  const response = await fetch(`/api/discussions/${source}/${startedAt}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`);
  return body as DiscussionView;
}

function DiscussionPage(props: { source: string; startedAt: string }) {
  const view = createMemo(() => fetchDiscussion(props.source, props.startedAt));
  const entries = createMemo(() => outline(view().page.blocks));
  const owners = createMemo(() => sectionOf(view().page.blocks));
  // Every section starts closed, and at most one is open.
  const [open, setOpen] = createSignal<string | undefined>(undefined);

  // A jump to a block, from the outline or a reference, opens its section,
  // closes the others, and brings the block into view.
  const jump = (id: string) => {
    setOpen(owners().get(id));
    flush();
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  onSettled(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href^='#']");
      if (!link) return;
      event.preventDefault();
      const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
      history.replaceState(null, "", `#${id}`);
      jump(id);
    };
    document.addEventListener("click", onClick);
    if (location.hash) jump(decodeURIComponent(location.hash.slice(1)));
    return () => document.removeEventListener("click", onClick);
  });

  return (
    <Errored fallback={(error) => <p class="error">{String(error())}</p>}>
      <Loading fallback={<p>Loading…</p>}>
        <div class="layout">
          <aside class="sidebar">
            <Outline entries={entries()} open={open()} />
          </aside>
          <div class="content">
            <header class="discussion-header">
              {view().ref.source} · version {view().discussion.version}
              {view().discussion.closed ? " · closed" : ""}
            </header>
            <main>
              <For each={view().page.blocks}>
                {(block) => (
                  <Show when={isSection(block)} fallback={<Blocks blocks={[block]} />}>
                    <Section
                      block={block}
                      open={open() === block.id}
                      onToggle={() => setOpen(open() === block.id ? undefined : block.id)}
                    />
                  </Show>
                )}
              </For>
            </main>
          </div>
        </div>
      </Loading>
    </Errored>
  );
}

function App() {
  const match = ROUTE.exec(location.pathname);
  if (!match) return <p>Open a discussion with <code>pnpm topic open &lt;source&gt; &lt;page.md&gt;</code>.</p>;
  return <DiscussionPage source={match[1]} startedAt={match[2]} />;
}

render(() => <App />, document.getElementById("root")!);

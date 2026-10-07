import { render } from "@solidjs/web";
import { Errored, For, Loading, Show, createEffect, createMemo, createSignal, flush, onSettled } from "solid-js";

import type { DiscussionView } from "@topic-overview/core";
import { labels, relations, walk } from "@topic-overview/core/page";

import { Beside } from "./components/Beside.tsx";
import { Blocks } from "./components/Blocks.tsx";
import { Outline } from "./components/Outline.tsx";
import { Section } from "./components/Section.tsx";
import { TaskHeader } from "./components/TaskHeader.tsx";
import { isSection, outline, sectionOf } from "./outline.ts";
import { RelateContext, relatedTo } from "./relate.ts";
import { taskHeader } from "./task.ts";
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
  const task = createMemo(() => taskHeader(view().page));
  const forward = createMemo(() => relations(view().page));
  const labelled = createMemo(() => labels(view().page));
  // The block the pointer is on, and the blocks tinted because they relate to it.
  const [pointed, setPointed] = createSignal<string | undefined>(undefined);
  const tinted = createMemo(() => {
    const id = pointed();
    return id ? relatedTo(id, forward()) : new Set<string>();
  });
  const onPointer = (event: PointerEvent) => {
    const id = (event.target as Element).closest?.("[data-block]")?.getAttribute("data-block") ?? undefined;
    if (id !== pointed()) setPointed(id);
  };
  const discussionLine = () =>
    `version ${view().discussion.version}${view().discussion.closed ? " · closed" : ""}`;
  const blocks = createMemo(() => new Map([...walk(view().page.blocks)].map((block) => [block.id, block])));
  // Every section starts closed, and at most one is open.
  const [open, setOpen] = createSignal<string | undefined>(undefined);
  // The section or subsection shown in the column beside, if any.
  const [beside, setBeside] = createSignal<string | undefined>(undefined);
  const besideBlock = () => {
    const id = beside();
    return id ? blocks().get(id) : undefined;
  };
  const blockText = (id: string) => blocks().get(id)?.text;

  // A jump to a block, from the outline or a reference, opens its section,
  // closes the others, and brings the block into view.
  const jump = (id: string, sections: Map<string, string> = owners()) => {
    setOpen(sections.get(id));
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
    return () => document.removeEventListener("click", onClick);
  });

  // A block named in the URL is jumped to once the discussion has loaded;
  // the compute waits for it, the apply runs once it is there.
  createEffect(
    () => owners(),
    (sections) => {
      // An effect's own flush is still running, so the jump waits for it.
      if (location.hash) queueMicrotask(() => jump(decodeURIComponent(location.hash.slice(1)), sections));
    },
  );

  return (
    <Errored fallback={(error) => <p class="error">{String(error())}</p>}>
      <Loading fallback={<p>Loading…</p>}>
        <RelateContext value={{ pointed, tinted, labels: labelled, blockText }}>
        <div
          class={["layout", { "with-beside": !!besideBlock() }]}
          onPointerOver={onPointer}
          onPointerLeave={() => setPointed(undefined)}
        >
          <aside class="sidebar">
            <Outline entries={entries()} open={open()} beside={beside()} onBeside={(id) => setBeside(id)} />
          </aside>
          <div class="content">
            <Show
              when={task()}
              fallback={
                <header class="discussion-header">
                  {view().ref.source} · {discussionLine()}
                </header>
              }
            >
              {(header) => <TaskHeader task={header()} discussion={discussionLine()} />}
            </Show>
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
          <Show when={besideBlock()}>{(block) => <Beside block={block()} onClose={() => setBeside(undefined)} />}</Show>
        </div>
        </RelateContext>
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

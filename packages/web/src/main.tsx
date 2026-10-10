import { render } from "@solidjs/web";
import { Errored, For, Loading, Show, createEffect, createMemo, createSignal, flush, onSettled } from "solid-js";

import type { DiscussionView } from "@topic-overview/core";
import { labels, relations, walk } from "@topic-overview/core/page";

import { AttachmentList } from "./components/AttachmentList.tsx";
import { BesideAttachment, BesidePage, BesideSection } from "./components/Beside.tsx";
import { Blocks } from "./components/Blocks.tsx";
import { type IntegrationState, IntegrationList } from "./components/IntegrationList.tsx";
import { Metadata } from "./components/Metadata.tsx";
import { Outline } from "./components/Outline.tsx";
import { Section } from "./components/Section.tsx";
import { TaskHeader } from "./components/TaskHeader.tsx";
import { isSection, outline, sectionOf } from "./outline.ts";
import { OpenPageContext } from "./column.ts";
import { CommentsContext, changeComments } from "./comments.ts";
import { CommentList } from "./components/CommentList.tsx";
import { type BlockingChange, type Change, ChangeNotice, type Notice, Notices, isBlocking } from "./components/ChangeNotice.tsx";
import { readAnswer } from "./http.ts";
import { forgetPreview } from "./previews.ts";
import { RelateContext, relatedTo } from "./relate.ts";
import { frontmatter, taskHeader } from "./task.ts";
import "./style.css";

const ROUTE = /^\/d\/([^/]+)\/([^/]+)\/?$/;
// Section 0, the metadata, folds and is listed like any other section, under
// a key no block has.
const METADATA = "metadata";

async function fetchDiscussion(source: string, startedAt: string): Promise<DiscussionView> {
  return readAnswer<DiscussionView>(await fetch(`/api/discussions/${source}/${startedAt}`));
}

function DiscussionPage(props: { source: string; startedAt: string }) {
  const view = createMemo(() => fetchDiscussion(props.source, props.startedAt));
  // The blocks before the first section, such as the title, come first; the
  // metadata section follows them, then the page's own sections.
  const firstSection = () => {
    const index = view().page.blocks.findIndex(isSection);
    return index === -1 ? view().page.blocks.length : index;
  };
  const leading = () => view().page.blocks.slice(0, firstSection());
  const sections = () => view().page.blocks.slice(firstSection());
  const entries = createMemo(() => [{ id: METADATA, text: "Metadata", depth: 0 }, ...outline(view().page.blocks)]);
  const owners = createMemo(() => new Map([[METADATA, METADATA], ...sectionOf(view().page.blocks)]));
  const task = createMemo(() => taskHeader(view().page));
  // An attachment relates to the blocks it is about, so pointing at it
  // highlights them.
  const forward = createMemo(() => {
    const related = relations(view().page);
    for (const attachment of view().attachments) related.set(`attachment:${attachment.id}`, new Set(attachment.blocks));
    return related;
  });
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
  // What the column beside shows, if anything: a section or subsection of
  // this page, or another page of the knowledge base.
  type Beside = { section: string } | { page: string } | { attachment: string };
  const [beside, setBeside] = createSignal<Beside | undefined>(undefined);
  const besideSection = () => {
    const shown = beside();
    return shown && "section" in shown ? blocks().get(shown.section) : undefined;
  };
  const besidePage = () => {
    const shown = beside();
    return shown && "page" in shown ? shown.page : undefined;
  };
  const blockText = (id: string) => blocks().get(id)?.text;
  const besideAttachment = () => {
    const shown = beside();
    return shown && "attachment" in shown ? view().attachments.find((attachment) => attachment.id === shown.attachment) : undefined;
  };

  // The comments, as the server last answered with them. Every change goes
  // to the server, which answers with the comments as they now are.
  const [annotations, setAnnotations] = createSignal(() => view().discussion.annotations);
  const base = `/api/discussions/${props.source}/${props.startedAt}`;
  const change = (method: "POST" | "PATCH" | "DELETE", id: string | undefined, body?: unknown) =>
    changeComments(base, method, id, body).then((next) => {
      setAnnotations(next);
    });
  const comments = {
    readOnly: () => view().discussion.closed !== null,
    of: (block: string) => annotations().filter((annotation) => annotation.target === block),
    add: (block: string, body: string) => change("POST", undefined, { target: block, body }),
    edit: (id: string, body: string) => change("PATCH", id, { body }),
    remove: (id: string) => change("DELETE", id),
  };

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

  // What changed outside while the page is open, told by the server. Once
  // something has, the page allows nothing but reloading.
  const [outsideChange, setOutsideChange] = createSignal<BlockingChange | undefined>(undefined);
  const [notices, setNotices] = createSignal<Notice[]>([]);
  // The state of each integration, asked once when the page opens and kept
  // current by the server's notices.
  const [states, setStates] = createSignal(new Map<string, IntegrationState>());
  let noticeCount = 0;
  onSettled(() => {
    fetch(`${base}/integrations`)
      .then((response) => readAnswer<IntegrationState[]>(response))
      .then((all) => setStates(new Map(all.map((state) => [state.id, state]))))
      .catch(() => {});
    const events = new EventSource(`${base}/events`);
    events.addEventListener("change", (event) => {
      const change = JSON.parse((event as MessageEvent).data) as Change;
      // A new version is what a hand-over asked for, so it is shown at once.
      if (change.kind === "version") return location.reload();
      if (isBlocking(change)) return setOutsideChange(change);
      if (change.kind === "linked") forgetPreview(change.page);
      // An integration's state belongs in its widget, not in a notice.
      if (change.kind === "integration") return setStates(new Map([...states(), [change.state.id, change.state]]));
      noticeCount += 1;
      setNotices([...notices(), { id: noticeCount, change }]);
    });
    return () => events.close();
  });
  const dismiss = (id: number) => setNotices(notices().filter((notice) => notice.id !== id));
  // A linked page open beside is shown again as it is now: the column is
  // created anew for it.
  const showAgain = (page: string) => {
    setBeside(undefined);
    queueMicrotask(() => setBeside({ page }));
    setNotices(notices().filter((notice) => notice.change.kind !== "linked" || notice.change.page !== page));
  };

  // The tab shows the page's icon from its frontmatter, as an emoji drawn into
  // an SVG, and its title: the task's key and title, or the source's name.
  createEffect(
    () => ({ fields: frontmatter(view().page), task: task(), source: view().ref.source }),
    ({ fields, task: header, source }) => {
      document.title = header ? `${header.key} · ${header.title}` : source;
      const icon = fields.icon?.trim();
      if (!icon) return;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`;
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.append(link);
      }
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    },
  );

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
        <Show when={outsideChange()}>{(shown) => <ChangeNotice change={shown()} base={base} />}</Show>
        <Notices notices={notices()} shownBeside={besidePage()} onShowAgain={showAgain} onDismiss={dismiss} />
        <RelateContext value={{ pointed, tinted, labels: labelled, blockText }}>
        <OpenPageContext value={(name: string) => setBeside({ page: name })}>
        <CommentsContext value={comments}>
        <div
          class={["layout", { "with-beside": !!beside() }]}
          onPointerOver={onPointer}
          onPointerLeave={() => setPointed(undefined)}
        >
          <aside class="sidebar">
            <IntegrationList integrations={view().discussion.integrations ?? []} states={states()} />
            <Outline
              entries={entries()}
              open={open()}
              beside={besideSection()?.id}
              onBeside={(id) => setBeside({ section: id })}
            />
            <AttachmentList
              attachments={view().attachments}
              open={besideAttachment()?.id}
              onOpen={(id) => setBeside({ attachment: id })}
            />
            <CommentList annotations={annotations()} blockText={blockText} />
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
              <For each={leading()}>{(block) => <Blocks blocks={[block]} />}</For>
              <Metadata
                view={view()}
                open={open() === METADATA}
                onToggle={() => setOpen(open() === METADATA ? undefined : METADATA)}
              />
              <For each={sections()}>
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
          <Show when={besideSection()}>
            {(block) => <BesideSection block={block()} onClose={() => setBeside(undefined)} />}
          </Show>
          <Show when={besideAttachment()} keyed>
            {(attachment) => <BesideAttachment attachment={attachment} base={base} onClose={() => setBeside(undefined)} />}
          </Show>
          <Show when={besidePage()} keyed>
            {(name) => <BesidePage name={name} onClose={() => setBeside(undefined)} />}
          </Show>
        </div>
        </CommentsContext>
        </OpenPageContext>
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

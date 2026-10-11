import { render } from "@solidjs/web";
import { Errored, For, Loading, Show, createEffect, createMemo, createSignal, flush, onSettled, refresh } from "solid-js";

import type { Block, DiscussionView, Mark, SourceProblem } from "@topic-overview/core";
import { excerpt, labels, relations, walk } from "@topic-overview/core/page";

import { AttachmentList } from "./components/AttachmentList.tsx";
import { BesideAsset, BesideAttachment, BesidePage, BesideSection } from "./components/Beside.tsx";
import { Blocks } from "./components/Blocks.tsx";
import { type IntegrationState, IntegrationList } from "./components/IntegrationList.tsx";
import { Metadata } from "./components/Metadata.tsx";
import { Outline } from "./components/Outline.tsx";
import { Section } from "./components/Section.tsx";
import { SourceProblems, problemKey } from "./components/SourceProblems.tsx";
import { TaskHeader } from "./components/TaskHeader.tsx";
import { headingKeys, innermost, isSection, outline, reveal, sectionOf, shownUnfolded, toggleFold } from "./outline.ts";
import { type Asset, AssetsContext, OpenAssetContext } from "./asset.ts";
import { OpenPageContext } from "./column.ts";
import { EditingContext } from "./editing.ts";
import { MarksContext } from "./marks.ts";
import { ProblemsContext } from "./problems.ts";
import { CommentsContext, changeComments } from "./comments.ts";
import { ChangeList } from "./components/ChangeList.tsx";
import { CommentList } from "./components/CommentList.tsx";
import { ConflictBanner } from "./components/ConflictBanner.tsx";
import { type BlockingChange, type Change, ChangeNotice, type Notice, Notices, isBlocking } from "./components/ChangeNotice.tsx";
import { readAnswer } from "./http.ts";
import { forgetPreview } from "./previews.ts";
import { RelateContext, relatedTo } from "./relate.ts";
import { reuse } from "./reuse.ts";
import { frontmatter, taskHeader } from "./task.ts";
import "./style.css";

// A discussion on a copy is `/d/<source>/<started-at>`; one on the source
// itself, in a worktree, is `/d/<key>`.
const ROUTE = /^\/d\/([^/]+)(?:\/([^/]+))?\/?$/;
// Section 0, the metadata, folds and is listed like any other section, under
// a key no block has.
const METADATA = "metadata";
// How long the page waits before opening its stream of changes again.
const RECONNECT = 2_000;
// How long a stream may stay silent, heartbeats included, before the page
// takes it for dead.
const SILENCE = 25_000;

async function fetchDiscussion(base: string): Promise<DiscussionView> {
  return readAnswer<DiscussionView>(await fetch(base));
}

// `base` is where the discussion is asked for; `live` says it is on the source
// itself, where comments are not kept.
function DiscussionPage(props: { base: string; live: boolean }) {
  const view = createMemo(() => fetchDiscussion(props.base));
  // The page as it is drawn: new content with every block that did not
  // change kept as it was, so only what changed is drawn again.
  let drawn: Block[] = [];
  const page = createMemo(() => {
    const next = { ...view().page, blocks: reuse(drawn, view().page.blocks) };
    drawn = next.blocks;
    return next;
  });
  // The blocks before the first section, such as the title, come first; the
  // metadata section follows them, then the page's own sections.
  const firstSection = () => {
    const index = page().blocks.findIndex(isSection);
    return index === -1 ? page().blocks.length : index;
  };
  const leading = () => page().blocks.slice(0, firstSection());
  const sections = () => page().blocks.slice(firstSection());
  const entries = createMemo(() => [{ id: METADATA, text: "Metadata", depth: 0 }, ...outline(page().blocks)]);
  const owners = createMemo(() => new Map([[METADATA, METADATA], ...sectionOf(page().blocks)]));
  const task = createMemo(() => taskHeader(page()));
  // An attachment relates to the blocks it is about, so pointing at it
  // highlights them.
  const forward = createMemo(() => {
    const related = relations(page());
    for (const attachment of view().attachments) related.set(`attachment:${attachment.id}`, new Set(attachment.blocks));
    problems().forEach((problem, index) => related.set(problemKey(index), new Set([problem.block])));
    return related;
  });
  const labelled = createMemo(() => labels(page()));
  // What cannot be rendered: what the server found in the source, and what
  // a block reports as it fails to render, such as a diagram that does not
  // parse. A block reports once it is opened, and once only.
  const [reported, setReported] = createSignal<SourceProblem[]>([]);
  const report = (block: string, reason: string) => {
    const text = blocks().get(block)?.text;
    if (text === undefined || reported().some((known) => known.block === block && known.reason === reason)) return;
    setReported([...reported(), { block, excerpt: excerpt(text), reason }]);
  };
  createEffect(
    () => page(),
    () => {
      setReported([]);
    },
  );
  const problems = createMemo(() => [...(view().problems ?? []), ...reported()]);
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
  // A discussion on the source itself has no versions, only its branch.
  const discussionLine = () =>
    view().branch ?? `version ${view().discussion.version}${view().discussion.closed ? " · closed" : ""}`;
  const blocks = createMemo(() => new Map([...walk(page().blocks)].map((block) => [block.id, block])));
  // The metadata folds as a section of its own, ahead of the page's; its
  // content is no block, so a stand-in makes it one that folds.
  const metadataSection: Block = {
    id: METADATA,
    kind: "block",
    text: "Metadata",
    properties: {},
    children: [{ id: `${METADATA}:content`, kind: "block", text: "", properties: {}, children: [] }],
  };
  const foldTree = (): Block[] => [metadataSection, ...page().blocks];
  // Which sections and headings are unfolded: the way down to the one thing
  // open. Everything starts folded, and the outline, the headings and a jump
  // all change it through the same functions. It is kept by the headings'
  // texts rather than by the blocks' numbers, which an edit shifts, so the
  // page keeps its place when the source changes.
  const [openKeys, setOpenKeys] = createSignal(new Set<string>());
  const keys = createMemo(() => headingKeys(foldTree()));
  const keyed = createMemo(() => new Map([...keys()].map(([id, key]) => [key, id])));
  const unfolded = createMemo(() => new Set([...openKeys()].flatMap((key) => keyed().get(key) ?? [])));
  const setUnfolded = (ids: Set<string>) => setOpenKeys(new Set([...ids].flatMap((id) => keys().get(id) ?? [])));
  const shown = createMemo(() => shownUnfolded(foldTree(), unfolded()));
  const toggle = (id: string) => {
    const next = toggleFold(foldTree(), unfolded(), id);
    setUnfolded(next);
    if (!next.has(id)) return;
    flush();
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };
  // What the column beside shows, if anything: a section or subsection of
  // this page, kept by its heading as what is open is, or another page of the
  // knowledge base.
  type Beside = { section: string } | { page: string } | { attachment: string } | { asset: Asset };
  const [beside, setBeside] = createSignal<Beside | undefined>(undefined);
  const besideSection = () => {
    const shown = beside();
    const id = shown && "section" in shown ? keyed().get(shown.section) : undefined;
    return id ? blocks().get(id) : undefined;
  };
  const besidePage = () => {
    const shown = beside();
    return shown && "page" in shown ? shown.page : undefined;
  };
  const blockText = (id: string) => blocks().get(id)?.text;
  const besideAsset = () => {
    const shown = beside();
    return shown && "asset" in shown ? shown.asset : undefined;
  };
  const besideAttachment = () => {
    const shown = beside();
    return shown && "attachment" in shown ? view().attachments.find((attachment) => attachment.id === shown.attachment) : undefined;
  };

  // The comments, as the server last answered with them. Every change goes
  // to the server, which answers with the comments as they now are.
  const [annotations, setAnnotations] = createSignal(() => view().discussion.annotations);
  const base = props.base;
  const change = (method: "POST" | "PATCH" | "DELETE", id: string | undefined, body?: unknown) =>
    changeComments(base, method, id, body).then((next) => {
      setAnnotations(next);
    });
  const comments = {
    readOnly: () => props.live || view().discussion.closed !== null,
    of: (block: string) => annotations().filter((annotation) => annotation.target === block),
    add: (block: string, body: string) => change("POST", undefined, { target: block, body }),
    edit: (id: string, body: string) => change("PATCH", id, { body }),
    remove: (id: string) => change("DELETE", id),
  };

  // A jump to a block, from the outline or a reference, opens its section,
  // closes the others, and brings the block into view.
  const jump = (id: string) => {
    setUnfolded(reveal(foldTree(), id));
    flush();
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  onSettled(() => {
    // A link something has handled already, such as an outline entry, is
    // left alone.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
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

  // The blocks the agent changed that I have not confirmed seeing, as the
  // server last told them: with the content, or after a confirmation.
  const [marks, setMarks] = createSignal(() => view().marks ?? []);
  const marking = {
    of: (block: string) => marks().find((mark) => mark.id === block)?.kind,
    clear: (block: string) => {
      fetch(`${base}/marks/${encodeURIComponent(block)}`, { method: "DELETE" })
        .then((response) => readAnswer<Mark[]>(response))
        .then(setMarks, () => {});
    },
  };

  // What the discussion's agent is doing, told by the server. While it works,
  // blocks are not edited from the page.
  const [agent, setAgent] = createSignal<string>("idle");
  // The files a merge from main stopped on, as the page loaded or as the
  // server told since; while there are any, nothing is edited.
  const [conflict, setConflict] = createSignal(() => view().conflict ?? []);
  const editing = {
    available: props.live,
    blocked: () =>
      conflict().length > 0
        ? "Merging main stopped on a conflict; resolve it in the terminal first"
        : agent() === "busy"
          ? "The agent is working; edit once it is done"
          : undefined,
    load: async (block: string) =>
      (await readAnswer<{ text: string }>(await fetch(`${base}/blocks/${encodeURIComponent(block)}`))).text,
    save: async (block: string, text: string) => {
      await readAnswer(
        await fetch(`${base}/blocks/${encodeURIComponent(block)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        }),
      );
    },
  };

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
    const onChange = (event: Event) => {
      const change = JSON.parse((event as MessageEvent).data) as Change;
      // A new version is what a hand-over asked for, so it is shown at once.
      // A change to the source is fetched and shown in place, keeping what is
      // open; the old content stays until the new one has arrived.
      if (change.kind === "version") return refresh(view);
      if (change.kind === "agent") return setAgent(change.state);
      if (change.kind === "conflict") return setConflict(change.files);
      if (isBlocking(change)) return setOutsideChange(change);
      if (change.kind === "linked") forgetPreview(change.page);
      // An integration's state belongs in its widget, not in a notice.
      if (change.kind === "integration") return setStates(new Map([...states(), [change.state.id, change.state]]));
      noticeCount += 1;
      setNotices([...notices(), { id: noticeCount, change }]);
    };
    // The stream is opened again when it ends for good, as it does when the
    // server restarts and the browser gets an error in between, or when it
    // falls silent, as it does behind a proxy that keeps a dead stream open;
    // the server's heartbeat says it is alive. The page then fetches the
    // source, since a change may have passed meanwhile.
    let events: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heard = Date.now();
    const connect = (again: boolean) => {
      heard = Date.now();
      events = new EventSource(`${base}/events`);
      events.addEventListener("change", (event) => {
        heard = Date.now();
        onChange(event);
      });
      events.addEventListener("heartbeat", () => (heard = Date.now()));
      if (again) events.addEventListener("open", () => refresh(view), { once: true });
      events.onerror = () => {
        if (events?.readyState !== EventSource.CLOSED) return;
        retry = setTimeout(() => connect(true), RECONNECT);
      };
    };
    connect(false);
    const alive = setInterval(() => {
      if (Date.now() - heard < SILENCE) return;
      events?.close();
      clearTimeout(retry);
      connect(true);
    }, SILENCE / 5);
    return () => {
      clearTimeout(retry);
      clearInterval(alive);
      events?.close();
    };
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
    () => ({ fields: frontmatter(page()), task: task(), source: view().ref.source }),
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
    () => {
      // An effect's own flush is still running, so the jump waits for it.
      if (location.hash) queueMicrotask(() => jump(decodeURIComponent(location.hash.slice(1))));
    },
  );

  return (
    <Errored fallback={(error) => <p class="error">{String(error())}</p>}>
      <Loading fallback={<p>Loading…</p>}>
        <Show when={outsideChange()}>{(shown) => <ChangeNotice change={shown()} base={base} />}</Show>
        <div class="notices" onPointerOver={onPointer} onPointerLeave={() => setPointed(undefined)}>
          <ConflictBanner files={conflict()} />
          <SourceProblems problems={problems()} />
          <Notices notices={notices()} shownBeside={besidePage()} onShowAgain={showAgain} onDismiss={dismiss} />
        </div>
        <AssetsContext value={props.live ? `${base}/assets` : undefined}>
        <ProblemsContext value={report}>
        <EditingContext value={editing}>
        <MarksContext value={marking}>
        <RelateContext value={{ pointed, tinted, labels: labelled, blockText }}>
        <OpenPageContext value={(name: string) => setBeside({ page: name })}>
        <OpenAssetContext value={(asset: Asset) => setBeside({ asset })}>
        <CommentsContext value={comments}>
        <div
          class={["layout", { "with-beside": !!beside() }]}
          onPointerOver={onPointer}
          onPointerLeave={() => setPointed(undefined)}
        >
          <aside class="sidebar">
            <ChangeList marks={marks()} blockText={blockText} onSeen={marking.clear} />
            <IntegrationList integrations={view().discussion.integrations ?? []} states={states()} />
            <Outline
              entries={entries()}
              current={innermost(foldTree(), unfolded())}
              onToggle={toggle}
              beside={besideSection()?.id}
              onBeside={(id) => setBeside({ section: keys().get(id) ?? id })}
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
              <Blocks blocks={leading()} />
              <Metadata
                view={view()}
                open={shown().has(METADATA)}
                onToggle={() => toggle(METADATA)}
              />
              <For each={sections()} keyed={(block) => block.id}>
                {(block) => (
                  <Show when={isSection(block())} fallback={<Blocks blocks={[block()]} />}>
                    <Section block={block()} unfolded={shown()} onToggle={toggle} />
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
          <Show when={besideAsset()} keyed>
            {(asset) => <BesideAsset asset={asset} onClose={() => setBeside(undefined)} />}
          </Show>
          <Show when={besidePage()} keyed>
            {(name) => <BesidePage name={name} onClose={() => setBeside(undefined)} />}
          </Show>
        </div>
        </CommentsContext>
        </OpenAssetContext>
        </OpenPageContext>
        </RelateContext>
        </MarksContext>
        </EditingContext>
        </ProblemsContext>
        </AssetsContext>
      </Loading>
    </Errored>
  );
}

function App() {
  const match = ROUTE.exec(location.pathname);
  if (!match) return <p>Open a discussion with <code>pnpm topic open &lt;key&gt;</code>.</p>;
  if (!match[2]) return <DiscussionPage base={`/api/topics/${match[1]}`} live />;
  return <DiscussionPage base={`/api/discussions/${match[1]}/${match[2]}`} live={false} />;
}

render(() => <App />, document.getElementById("root")!);

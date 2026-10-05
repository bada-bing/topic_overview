import { render } from "@solidjs/web";
import { Errored, Loading, createMemo } from "solid-js";

import { Blocks } from "./components/Blocks.tsx";
import type { DiscussionView } from "./types.ts";
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
  return (
    <Errored fallback={(error) => <p class="error">{String(error())}</p>}>
      <Loading fallback={<p>Loading…</p>}>
        <header class="discussion-header">
          {view().ref.source} · version {view().discussion.version}
          {view().discussion.closed ? " · closed" : ""}
        </header>
        <main>
          <Blocks blocks={view().page.blocks} />
        </main>
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

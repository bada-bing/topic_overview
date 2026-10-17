import type { JSX } from "@solidjs/web";
import { Errored, Loading, createMemo, untrack } from "solid-js";

import type { ElsewhereBlock } from "@topic-overview/core";
import type { Block, Page } from "@topic-overview/core/page";

import { ColumnContext, SourcePageContext } from "../column.ts";
import { readAnswer } from "../http.ts";
import { Blocks } from "./Blocks.tsx";
import { type Asset, assetName } from "../asset.ts";
import { AssetView } from "./AssetView.tsx";
import { Text } from "./Text.tsx";

// The column beside the main one, for comparing two parts of a topic. It
// scrolls on its own and closes with its button.
function Column(props: { title: string; onClose: () => void; children: JSX.Element }) {
  return (
    <aside class="beside">
      <header class="beside-header">
        <span class="beside-title">
          <Text text={props.title} />
        </span>
        <button type="button" class="beside-close" title="Close the column beside" onClick={() => props.onClose()}>
          ×
        </button>
      </header>
      <ColumnContext value="beside">{props.children}</ColumnContext>
    </aside>
  );
}

// A section or subsection of the discussion's own page, shown whole.
export function BesideSection(props: { block: Block; onClose: () => void }) {
  return (
    <Column title={props.block.text} onClose={props.onClose}>
      <Blocks blocks={props.block.children} />
    </Column>
  );
}

// An asset of the page, drawn in full.
export function BesideAsset(props: { asset: Asset; onClose: () => void }) {
  return (
    <Column title={assetName(props.asset)} onClose={props.onClose}>
      <div class="beside-asset">
        <AssetView asset={props.asset} />
      </div>
    </Column>
  );
}

// A block from another page of the knowledge base, zoomed in on: the block
// and everything under it, as the discussion's branch has them, under its
// page's name, which opens the whole page. A journal's date is only a name,
// since the column does not show journals.
export function BesideBlock(props: { found: ElsewhereBlock; onClose: () => void }) {
  return (
    <Column title={props.found.journal ? props.found.page : `[[${props.found.page}]]`} onClose={props.onClose}>
      <SourcePageContext value={props.found.page}>
        <Blocks blocks={[props.found.block]} />
      </SourcePageContext>
    </Column>
  );
}

async function fetchPage(name: string): Promise<Page> {
  return readAnswer<Page>(await fetch(`/api/source/${encodeURIComponent(name)}`, { cache: "no-store" }));
}

// Another page of the knowledge base, read as it is now. Its blocks are
// keyed by the page they come from, so they never pass for the discussion's.
// The column is created anew for every page opened in it, so the name is
// read once.
export function BesidePage(props: { name: string; onClose: () => void }) {
  const name = untrack(() => props.name);
  const page = createMemo(() => fetchPage(name));
  return (
    <Column title={name} onClose={props.onClose}>
      <Errored fallback={(error) => <p class="error">{String(error())}</p>}>
        <Loading fallback={<p>Loading…</p>}>
          <SourcePageContext value={name}>
            <Blocks blocks={page().blocks} />
          </SourcePageContext>
        </Loading>
      </Errored>
    </Column>
  );
}


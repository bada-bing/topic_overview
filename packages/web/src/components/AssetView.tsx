import { Errored, For, Loading, Show, createMemo, untrack } from "solid-js";

import { type Asset, DIAGRAM_LANGUAGES, assetSource, useAssets } from "../asset.ts";
import { type DocumentPart, parseDocument } from "../document.ts";
import { Diagram } from "./Diagram.tsx";
import { TableView } from "./TableView.tsx";
import { Text } from "./Text.tsx";

// An asset drawn in full, in a preview or in the column beside.
export function AssetView(props: { asset: Asset }) {
  const asset = props.asset;
  if (asset.kind === "table") return <TableView table={asset.table} />;
  if (asset.kind === "diagram") return <Diagram language={asset.language} source={asset.source} />;
  if (asset.kind === "document") return <Document name={asset.name} src={asset.src} />;
  return <Image alt={asset.alt} src={asset.src} />;
}

// An image the source links to. One the page cannot fetch stays the markdown
// it is written as, so nothing is lost.
function Image(props: { alt: string; src: string }) {
  const base = useAssets();
  const source = () => assetSource(props.src, base);
  return (
    <Show when={source()} fallback={<span class="image-missing">{`![${props.alt}](${props.src})`}</span>}>
      {(shown) => <img class="block-image" src={shown()} alt={props.alt} />}
    </Show>
  );
}

// Each part keyed by its content, and by how many alike came before it, so
// a part the file still has keeps what was drawn of it, such as a diagram.
async function fetchDocument(url: string): Promise<{ key: string; part: DocumentPart }[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`the document could not be read: ${response.status}`);
  const seen = new Map<string, number>();
  return parseDocument(await response.text()).map((part) => {
    const content = JSON.stringify(part);
    const count = (seen.get(content) ?? 0) + 1;
    seen.set(content, count);
    return { key: `${count}:${content}`, part };
  });
}

// A markdown file the source links to, read when it is shown and again
// when it changes, keeping what shows until the new one arrives. Its tables
// and diagrams are drawn in place, since the document is already what was
// opened. One the page cannot fetch stays the link it is written as.
function Document(props: { name: string; src: string }) {
  const base = useAssets();
  const source = createMemo(() => assetSource(props.src, base));
  const parts = createMemo(() => {
    const url = source();
    return url ? fetchDocument(url) : [];
  });
  return (
    <Show when={source()} fallback={<span class="image-missing">{`[${props.name}](${props.src})`}</span>}>
      <div class="document">
        <Errored fallback={(error) => <p class="error">{String(error())}</p>}>
          <Loading fallback={<p>Loading…</p>}>
            <For each={parts()} keyed={(entry) => entry.key}>
              {(entry) => <DocumentPiece part={untrack(entry).part} />}
            </For>
          </Loading>
        </Errored>
      </div>
    </Show>
  );
}

export function DocumentPiece(props: { part: DocumentPart }) {
  const part = props.part;
  if (part.kind === "heading") {
    return (
      <div class={`document-heading document-heading-${Math.min(part.level, 4)}`}>
        <Text text={part.text} />
      </div>
    );
  }
  if (part.kind === "item") {
    return (
      <div class="document-item" style={{ "margin-left": `${part.depth * 1.2}em` }}>
        <Text text={part.text} />
      </div>
    );
  }
  if (part.kind === "paragraph") {
    return (
      <p class="document-paragraph">
        <Text text={part.text} />
      </p>
    );
  }
  if (part.kind === "table") return <TableView table={part.table} />;
  if (DIAGRAM_LANGUAGES.has(part.language)) return <Diagram language={part.language} source={part.code} />;
  return (
    <pre class="codeblock">
      <code>{part.code}</code>
    </pre>
  );
}

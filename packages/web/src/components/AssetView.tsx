import { Errored, For, Loading, Show, createMemo } from "solid-js";

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
  const source = assetSource(props.src, useAssets());
  return (
    <Show when={source} fallback={<span class="image-missing">{`![${props.alt}](${props.src})`}</span>}>
      {(shown) => <img class="block-image" src={shown()} alt={props.alt} />}
    </Show>
  );
}

async function fetchDocument(url: string): Promise<DocumentPart[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`the document could not be read: ${response.status}`);
  return parseDocument(await response.text());
}

// A markdown file the source links to, read when it is shown, so it is as
// current as the file. Its tables and diagrams are drawn in place, since the
// document is already what was opened. One the page cannot fetch stays the
// link it is written as.
function Document(props: { name: string; src: string }) {
  const source = assetSource(props.src, useAssets());
  if (!source) return <span class="image-missing">{`[${props.name}](${props.src})`}</span>;
  const parts = createMemo(() => fetchDocument(source));
  return (
    <div class="document">
      <Errored fallback={(error) => <p class="error">{String(error())}</p>}>
        <Loading fallback={<p>Loading…</p>}>
          <For each={parts()}>{(part) => <DocumentPiece part={part} />}</For>
        </Loading>
      </Errored>
    </div>
  );
}

function DocumentPiece(props: { part: DocumentPart }) {
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

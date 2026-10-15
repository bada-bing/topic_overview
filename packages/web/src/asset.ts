import { createContext, createSignal, useContext } from "solid-js";

import { parseText } from "./inline.ts";
import type { Table } from "./table.ts";

// What a block holds besides its text: an image, a diagram, a table, or a
// document, a markdown file in the knowledge base's assets/ that a block
// links to. An asset shows as its name until it is wanted: hovering it
// previews it, and clicking it opens it in the column beside.
export type Asset =
  | { kind: "image"; alt: string; src: string }
  | { kind: "diagram"; language: string; source: string }
  | { kind: "table"; table: Table }
  | { kind: "document"; name: string; src: string };

const NAME_LENGTH = 48;

export function assetName(asset: Asset): string {
  if (asset.kind === "image") return asset.alt || asset.src.split("/").pop() || "image";
  if (asset.kind === "diagram") return `${asset.language} diagram`;
  if (asset.kind === "document") return asset.name;
  const columns = asset.table.header.join(", ");
  return `table: ${columns.length > NAME_LENGTH ? `${columns.slice(0, NAME_LENGTH - 1)}…` : columns}`;
}

// The assets in a block's text, in order, so a reference to the block can
// preview what it holds.
export function assetsIn(text: string): Asset[] {
  const assets: Asset[] = [];
  for (const part of parseText(text)) {
    if (part.kind === "table") assets.push({ kind: "table", table: part.table });
    else if (part.kind === "codeblock" && DIAGRAM_LANGUAGES.has(part.language)) {
      assets.push({ kind: "diagram", language: part.language, source: part.code });
    } else if (part.kind === "inline") {
      for (const inline of part.inlines) {
        if (inline.kind === "image") assets.push({ kind: "image", alt: inline.alt, src: inline.src });
        else if (inline.kind === "link" && isDocument(inline.href)) assets.push(documentAsset(inline.text, inline.href));
      }
    }
  }
  return assets;
}

// A link to a markdown file of the knowledge base's assets/, written relative
// to the page as Logseq writes it.
const DOCUMENT = /^(?:\.\.\/)?assets\/[^/]+\.md$/i;

export function isDocument(href: string): boolean {
  return DOCUMENT.test(href);
}

// A document named by its link's text, or by its file when the link has none
// of its own.
export function documentAsset(text: string, href: string): Asset {
  const file = decodeURIComponent(href.split("/").pop() ?? href);
  return { kind: "document", name: text && text !== href ? text : file, src: href };
}

// The notations a diagram can be written in, each rendered by its own library.
export const DIAGRAM_LANGUAGES = new Set(["mermaid", "bpmn"]);

// Opening an asset in the column beside.
export const OpenAssetContext = createContext<(asset: Asset) => void>(() => {});

// Where the files a page links to are fetched from, such as an image in the
// knowledge base's assets/. A page that cannot serve its files has none.
export const AssetsContext = createContext<string | undefined>(undefined);

// A file of the knowledge base's assets/, written relative to the page as
// Logseq does, by its name there.
function assetFile(src: string): string | undefined {
  const asset = /^(?:\.\.\/)?assets\/([^/]+)$/.exec(src);
  return asset ? decodeURIComponent(asset[1]) : undefined;
}

// An asset file's address: a full URL as it is, and a file of the knowledge
// base through the server, naming how many times it changed while the page
// is open, so a change is fetched rather than read from the cache.
export function assetSource(src: string, base: string | undefined): string | undefined {
  if (/^https?:\/\//.test(src)) return src;
  const file = assetFile(src);
  if (!file || !base) return undefined;
  const version = changes().get(file);
  return `${base}/${encodeURIComponent(file)}${version ? `?v=${version}` : ""}`;
}

// How many times each file of assets/ changed while the page is open, as
// the server tells it.
const [changes, setChanges] = createSignal<ReadonlyMap<string, number>>(new Map());

export function assetChanged(file: string): void {
  setChanges((known) => new Map([...known, [file, (known.get(file) ?? 0) + 1]]));
}

export function useAssets(): string | undefined {
  return useContext(AssetsContext);
}

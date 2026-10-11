import { createContext, useContext } from "solid-js";

import { parseText } from "./inline.ts";
import type { Table } from "./table.ts";

// What a block holds besides its text: an image, a diagram or a table. An
// asset shows as its name until it is wanted: hovering it previews it, and
// clicking it opens it in the column beside.
export type Asset =
  | { kind: "image"; alt: string; src: string }
  | { kind: "diagram"; language: string; source: string }
  | { kind: "table"; table: Table };

const NAME_LENGTH = 48;

export function assetName(asset: Asset): string {
  if (asset.kind === "image") return asset.alt || asset.src.split("/").pop() || "image";
  if (asset.kind === "diagram") return `${asset.language} diagram`;
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
      for (const inline of part.inlines) if (inline.kind === "image") assets.push({ kind: "image", alt: inline.alt, src: inline.src });
    }
  }
  return assets;
}

// The notations a diagram can be written in, each rendered by its own library.
export const DIAGRAM_LANGUAGES = new Set(["mermaid", "bpmn"]);

// Opening an asset in the column beside.
export const OpenAssetContext = createContext<(asset: Asset) => void>(() => {});

// Where the files a page links to are fetched from, such as an image in the
// knowledge base's assets/. A page that cannot serve its files has none.
export const AssetsContext = createContext<string | undefined>(undefined);

// An image's address: a full URL as it is, and a file of the knowledge base,
// written relative to the page as Logseq does, through the server.
export function imageSource(src: string, base: string | undefined): string | undefined {
  if (/^https?:\/\//.test(src)) return src;
  const asset = /^(?:\.\.\/)?assets\/([^/]+)$/.exec(src);
  return asset && base ? `${base}/${encodeURIComponent(decodeURIComponent(asset[1]))}` : undefined;
}

export function useAssets(): string | undefined {
  return useContext(AssetsContext);
}

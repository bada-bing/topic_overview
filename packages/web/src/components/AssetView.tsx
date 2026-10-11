import { Show } from "solid-js";

import { type Asset, imageSource, useAssets } from "../asset.ts";
import { Diagram } from "./Diagram.tsx";
import { TableView } from "./TableView.tsx";

// An asset drawn in full, in a preview or in the column beside.
export function AssetView(props: { asset: Asset }) {
  const asset = props.asset;
  if (asset.kind === "table") return <TableView table={asset.table} />;
  if (asset.kind === "diagram") return <Diagram language={asset.language} source={asset.source} />;
  return <Image alt={asset.alt} src={asset.src} />;
}

// An image the source links to. One the page cannot fetch stays the markdown
// it is written as, so nothing is lost.
function Image(props: { alt: string; src: string }) {
  const source = imageSource(props.src, useAssets());
  return (
    <Show when={source} fallback={<span class="image-missing">{`![${props.alt}](${props.src})`}</span>}>
      {(shown) => <img class="block-image" src={shown()} alt={props.alt} />}
    </Show>
  );
}

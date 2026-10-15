import { Show, createSignal, useContext } from "solid-js";

import { type Asset, OpenAssetContext, assetName } from "../asset.ts";
import { AssetView } from "./AssetView.tsx";

const ICONS: Record<Asset["kind"], string> = { image: "🖼", diagram: "◇", table: "▦", document: "▤" };

// An asset as its name, so it is there without being in the way. Hovering it
// previews it at a fixed size, drawn only then; clicking it opens it in the
// column beside.
export function AssetChip(props: { asset: Asset }) {
  const open = useContext(OpenAssetContext);
  const [hovered, setHovered] = createSignal(false);
  return (
    <span
      class="asset-chip has-preview"
      role="link"
      tabindex="0"
      onPointerEnter={() => setHovered(true)}
      onClick={() => open(props.asset)}
    >
      <span class="asset-icon">{ICONS[props.asset.kind]}</span>
      {assetName(props.asset)}
      <Show when={hovered()}>
        <span class="preview asset-preview">
          <AssetView asset={props.asset} />
        </span>
      </Show>
    </span>
  );
}

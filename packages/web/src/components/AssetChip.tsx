import { Show, createSignal, useContext } from "solid-js";

import { type Asset, OpenAssetContext, assetName } from "../asset.ts";
import { AssetView } from "./AssetView.tsx";

// The preview's height, as the stylesheet gives it, with its margin.
const PREVIEW_HEIGHT = 330;

const ICONS: Record<Asset["kind"], string> = { image: "🖼", diagram: "◇", table: "▦", document: "▤" };

// An asset as its name, so it is there without being in the way. Hovering it
// previews it at a fixed size, drawn only then, above the name when the
// window has no room for it below; clicking it opens it in the column beside.
export function AssetChip(props: { asset: Asset }) {
  const open = useContext(OpenAssetContext);
  const [hovered, setHovered] = createSignal(false);
  const [above, setAbove] = createSignal(false);
  const enter = (event: PointerEvent) => {
    const chip = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setAbove(window.innerHeight - chip.bottom < PREVIEW_HEIGHT && chip.top > window.innerHeight - chip.bottom);
    setHovered(true);
  };
  return (
    <span
      class="asset-chip has-preview"
      role="link"
      tabindex="0"
      onPointerEnter={enter}
      onClick={() => open(props.asset)}
    >
      <span class="asset-icon">{ICONS[props.asset.kind]}</span>
      {assetName(props.asset)}
      <Show when={hovered()}>
        <span class={["preview", "asset-preview", { above: above() }]}>
          <AssetView asset={props.asset} />
        </span>
      </Show>
    </span>
  );
}

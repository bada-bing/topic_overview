import { Show } from "solid-js";

import type { Block } from "@topic-overview/core";

import { useBlockIdentity } from "../column.ts";
import { useRelate } from "../relate.ts";
import { splitMarker } from "../inline.ts";
import { Text } from "./Text.tsx";

// A regular block: its text, led by its task marker when it has one.
export function Paragraph(props: { block: Block }) {
  const parts = () => splitMarker(props.block.text);
  const relate = useRelate();
  const identity = useBlockIdentity();
  return (
    <div id={identity.elementId(props.block.id)} data-block={identity.key(props.block.id)} class={["paragraph", { [`state-${parts().marker?.toLowerCase()}`]: !!parts().marker, tinted: relate.tinted().has(identity.key(props.block.id)), pointed: relate.pointed() === identity.key(props.block.id) }]}>
      <Show when={parts().marker}>{(marker) => <span class="marker">{marker()}</span>}</Show>
      <Text text={parts().text} />
    </div>
  );
}

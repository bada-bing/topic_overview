import { Show } from "solid-js";

import type { Block } from "@topic-overview/core";

import { splitMarker } from "../inline.ts";
import { Text } from "./Text.tsx";

// A regular block: its text, led by its task marker when it has one.
export function Paragraph(props: { block: Block }) {
  const parts = () => splitMarker(props.block.text);
  return (
    <div id={props.block.id} class={["paragraph", { [`state-${parts().marker?.toLowerCase()}`]: !!parts().marker }]}>
      <Show when={parts().marker}>{(marker) => <span class="marker">{marker()}</span>}</Show>
      <Text text={parts().text} />
    </div>
  );
}

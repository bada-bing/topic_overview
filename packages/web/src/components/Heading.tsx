import { Dynamic } from "@solidjs/web";

import type { Block } from "@topic-overview/core";

// A heading block, h1 to h6 by its level.
export function Heading(props: { block: Block }) {
  return (
    <Dynamic component={`h${Math.min(props.block.level ?? 1, 6)}`} id={props.block.id} class="heading">
      {props.block.text}
    </Dynamic>
  );
}

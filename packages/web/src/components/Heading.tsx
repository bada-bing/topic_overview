import { dynamic } from "@solidjs/web";

import type { Block } from "@topic-overview/core";

import { Text } from "./Text.tsx";

// A heading block, h1 to h6 by its level.
export function Heading(props: { block: Block }) {
  const Tag = dynamic(() => `h${Math.min(props.block.level ?? 1, 6)}`);
  return (
    <Tag id={props.block.id} class="heading">
      <Text text={props.block.text} />
    </Tag>
  );
}

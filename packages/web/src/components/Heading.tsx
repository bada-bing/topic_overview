import { dynamic } from "@solidjs/web";

import type { Block } from "@topic-overview/core";

import { blockId } from "../column.ts";
import { useRelate } from "../relate.ts";
import { Text } from "./Text.tsx";

// A heading block, h1 to h6 by its level.
export function Heading(props: { block: Block }) {
  const Tag = dynamic(() => `h${Math.min(props.block.level ?? 1, 6)}`);
  const relate = useRelate();
  return (
    <Tag id={blockId(props.block.id)} data-block={props.block.id} class={["heading", { tinted: relate.tinted().has(props.block.id), pointed: relate.pointed() === props.block.id }]}>
      <Text text={props.block.text} />
    </Tag>
  );
}

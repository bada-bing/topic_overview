import { dynamic } from "@solidjs/web";

import type { Block } from "@topic-overview/core";

import { useBlockIdentity } from "../column.ts";
import { useRelate } from "../relate.ts";
import { Text } from "./Text.tsx";

// A heading block, h1 to h6 by its level.
export function Heading(props: { block: Block }) {
  const Tag = dynamic(() => `h${Math.min(props.block.level ?? 1, 6)}`);
  const relate = useRelate();
  const identity = useBlockIdentity();
  return (
    <Tag id={identity.elementId(props.block.id)} data-block={identity.key(props.block.id)} class={["heading", { tinted: relate.tinted().has(identity.key(props.block.id)), pointed: relate.pointed() === identity.key(props.block.id) }]}>
      <Text text={props.block.text} />
    </Tag>
  );
}

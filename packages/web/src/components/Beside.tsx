import type { Block } from "@topic-overview/core";

import { ColumnContext } from "../column.ts";
import { Blocks } from "./Blocks.tsx";
import { Text } from "./Text.tsx";

// The column beside the main one: a section or subsection shown whole, for
// comparing it with another part of the page. It scrolls on its own.
export function Beside(props: { block: Block; onClose: () => void }) {
  return (
    <aside class="beside">
      <header class="beside-header">
        <span class="beside-title">
          <Text text={props.block.text} />
        </span>
        <button type="button" class="beside-close" title="Close the column beside" onClick={() => props.onClose()}>
          ×
        </button>
      </header>
      <ColumnContext value="beside">
        <Blocks blocks={props.block.children} />
      </ColumnContext>
    </aside>
  );
}

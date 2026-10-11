import type { Mark } from "@topic-overview/core";

import { useMarks } from "../marks.ts";
import { MarkSeen } from "./MarkSeen.tsx";

// Where the agent removed a block: a red line in its place, with the check
// that confirms I saw it, and what it read on the check's hover.
export function RemovedLine(props: { mark: Mark }) {
  const marks = useMarks();
  return (
    <div class="removed-line">
      <hr />
      <MarkSeen mark={props.mark} onSeen={() => marks.clear(props.mark)} />
    </div>
  );
}

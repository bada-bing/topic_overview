import { createContext, useContext } from "solid-js";

import type { Mark } from "@topic-overview/core";

// The blocks the agent changed that I have not confirmed seeing, and the
// confirming. A block is matched by its id. While the agent works, nothing is
// confirmed, so one writer works at a time.
export interface Marks {
  of: (block: string) => Mark | undefined;
  removedBefore: (block: string) => Mark[]; // removed blocks whose place this block took
  removedAtEnd: (parent: string) => Mark[]; // removed blocks that ended this parent's children
  clear: (mark: Mark) => void;
  blocked: () => string | undefined; // why nothing can be confirmed now: the agent works
}

export const MarksContext = createContext<Marks>({
  of: () => undefined,
  removedBefore: () => [],
  removedAtEnd: () => [],
  clear: () => {},
  blocked: () => undefined,
});

export function useMarks(): Marks {
  return useContext(MarksContext);
}

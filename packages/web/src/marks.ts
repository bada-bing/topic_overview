import { createContext, useContext } from "solid-js";

import type { Mark } from "@topic-overview/core";

// The blocks the agent changed that I have not confirmed seeing, and the
// confirming.
export interface Marks {
  of: (block: string) => Mark["kind"] | undefined;
  clear: (block: string) => void;
}

export const MarksContext = createContext<Marks>({ of: () => undefined, clear: () => {} });

export function useMarks(): Marks {
  return useContext(MarksContext);
}

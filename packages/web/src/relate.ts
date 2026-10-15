import { createContext, useContext } from "solid-js";

import type { ElsewhereBlock } from "@topic-overview/core";

// The relations on a page as the blocks see them: which block the pointer is
// on, which blocks are tinted because they relate to it, and which block a
// label such as AC3 names. A block another page holds is known by its id
// too, with its page.
export interface Relate {
  pointed: () => string | undefined;
  tinted: () => Set<string>;
  labels: () => Map<string, string>;
  blockText: (id: string) => string | undefined;
  elsewhere: (id: string) => ElsewhereBlock | undefined;
}

export const RelateContext = createContext<Relate>({
  pointed: () => undefined,
  tinted: () => new Set(),
  labels: () => new Map(),
  blockText: () => undefined,
  elsewhere: () => undefined,
});

export function useRelate(): Relate {
  return useContext(RelateContext);
}

// The blocks related to one block, in either direction.
export function relatedTo(id: string, forward: Map<string, Set<string>>): Set<string> {
  const related = new Set(forward.get(id) ?? []);
  for (const [from, targets] of forward) if (targets.has(id)) related.add(from);
  related.delete(id);
  return related;
}

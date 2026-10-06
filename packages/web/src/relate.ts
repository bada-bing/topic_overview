import { createContext, useContext } from "solid-js";

// The relations on a page as the blocks see them: which block the pointer is
// on, which blocks are tinted because they relate to it, and which block a
// label such as AC3 names.
export interface Relate {
  pointed: () => string | undefined;
  tinted: () => Set<string>;
  labels: () => Map<string, string>;
}

export const RelateContext = createContext<Relate>({
  pointed: () => undefined,
  tinted: () => new Set(),
  labels: () => new Map(),
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

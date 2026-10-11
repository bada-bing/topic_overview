import { createContext, useContext } from "solid-js";

// Which sections and headings are unfolded, and how one folds or unfolds
// itself. Without it everything is unfolded and nothing toggles, as in the
// column beside.
export interface Fold {
  unfolded: () => Set<string> | undefined;
  toggle?: (id: string) => void;
}

export const FoldContext = createContext<Fold>({ unfolded: () => undefined });

export function useFold(): Fold {
  return useContext(FoldContext);
}

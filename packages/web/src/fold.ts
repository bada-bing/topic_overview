import { createContext, useContext } from "solid-js";

// Which blocks show their children, while one heading of a section is chosen
// in the outline. Undefined unfolds everything, as in the column beside.
export const FoldContext = createContext<() => Set<string> | undefined>(() => undefined);

export function useFold(): () => Set<string> | undefined {
  return useContext(FoldContext);
}

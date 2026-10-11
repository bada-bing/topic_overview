import { createContext, useContext } from "solid-js";

// How a block reports, as it is rendered, that it cannot be: a diagram that
// fails to parse. The page adds it to the banner of what cannot be rendered.
export const ProblemsContext = createContext<(block: string, reason: string) => void>(() => {});

export function useProblems(): (block: string, reason: string) => void {
  return useContext(ProblemsContext);
}

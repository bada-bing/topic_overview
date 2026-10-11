import { createContext, useContext } from "solid-js";

// Editing a block's own text from the page, in a discussion on the source
// itself. While the agent works, nothing is edited, so one writer works at a
// time.
export interface Editing {
  available: boolean; // only in a discussion on the source itself
  blocked: () => string | undefined; // why nothing can be edited now: the agent works, or a merge stopped
  load: (block: string) => Promise<string>;
  save: (block: string, text: string) => Promise<void>;
}

export const EditingContext = createContext<Editing>({
  available: false,
  blocked: () => undefined,
  load: async () => "",
  save: async () => {},
});

export function useEditing(): Editing {
  return useContext(EditingContext);
}

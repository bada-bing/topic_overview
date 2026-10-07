import { createContext, useContext } from "solid-js";

// Which column a block is rendered in. A block can show in both, and only
// the main column carries the element ids that links jump to.
export type Column = "main" | "beside";

export const ColumnContext = createContext<Column>("main");


// The referenced page a block comes from, or "" for the discussion's own.
// A referenced page numbers its blocks itself, so their keys carry its name.
// Solid treats an undefined default as no default, hence the empty string.
export const SourcePageContext = createContext<string>("");

// Read once, when a block component is set up: the element id a block
// carries, only in the main column, and the key it is pointed at by.
export function useBlockIdentity(): { elementId: (id: string) => string | undefined; key: (id: string) => string } {
  const column = useContext(ColumnContext);
  const page = useContext(SourcePageContext);
  return {
    elementId: (id) => (column === "main" && !page ? id : undefined),
    key: (id) => (page ? `${page}:${id}` : id),
  };
}

// Opening a referenced page in the column beside.
export const OpenPageContext = createContext<(name: string) => void>(() => {});

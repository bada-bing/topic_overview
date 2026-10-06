import { createContext, useContext } from "solid-js";

// Which column a block is rendered in. A block can show in both, and only
// the main column carries the element ids that links jump to.
export type Column = "main" | "beside";

export const ColumnContext = createContext<Column>("main");

export function blockId(id: string): string | undefined {
  return useContext(ColumnContext) === "main" ? id : undefined;
}

import { For } from "solid-js";

import type { Table } from "../table.ts";
import { Text } from "./Text.tsx";

// A markdown table, its cells rendered as text, whether it is written in a
// block or kept as an attachment.
export function TableView(props: { table: Table }) {
  return (
    <table class="attachment-table">
      <thead>
        <tr>
          <For each={props.table.header}>{(cell) => <th><Text text={cell} /></th>}</For>
        </tr>
      </thead>
      <tbody>
        <For each={props.table.rows}>
          {(row) => (
            <tr>
              <For each={row}>{(cell) => <td><Text text={cell} /></td>}</For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

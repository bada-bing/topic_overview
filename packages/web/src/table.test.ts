import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTable, splitTables } from "./table.ts";

test("a markdown table is read into a header and rows", () => {
  assert.deepEqual(parseTable("| Bed | Crop |\n|---|:---:|\n| north | beans |\n| south | a \\| b |\n"), {
    header: ["Bed", "Crop"],
    rows: [
      ["north", "beans"],
      ["south", "a | b"],
    ],
  });
});

test("text without a separator row is not a table", () => {
  assert.equal(parseTable("| Bed | Crop |\n| north | beans |"), undefined);
});

test("a table written among the lines of a block is taken out of the text", () => {
  assert.deepEqual(splitTables("Beds:\n| Bed | Crop |\n|---|---|\n| north | beans |\nThat is all."), [
    { kind: "text", text: "Beds:" },
    { kind: "table", table: { header: ["Bed", "Crop"], rows: [["north", "beans"]] } },
    { kind: "text", text: "That is all." },
  ]);
});

test("a line that only starts with a pipe stays text", () => {
  assert.deepEqual(splitTables("| not a table"), [{ kind: "text", text: "| not a table" }]);
});

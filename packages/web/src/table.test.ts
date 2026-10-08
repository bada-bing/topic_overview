import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTable } from "./table.ts";

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

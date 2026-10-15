import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDocument } from "./document.ts";

test("a document is split into headings, items, paragraphs, tables and code blocks", () => {
  const text = [
    "# Plan",
    "",
    "What is left, with **owners**.",
    "Second line.",
    "",
    "- first",
    "\t- nested",
    "",
    "| Step | Owner |",
    "| --- | --- |",
    "| Deploy | me |",
    "",
    "```mermaid",
    "graph TD",
    "",
    "  A --> B",
    "```",
  ].join("\n");
  assert.deepEqual(parseDocument(text), [
    { kind: "heading", level: 1, text: "Plan" },
    { kind: "paragraph", text: "What is left, with **owners**.\nSecond line." },
    { kind: "item", depth: 0, text: "first" },
    { kind: "item", depth: 1, text: "nested" },
    { kind: "table", table: { header: ["Step", "Owner"], rows: [["Deploy", "me"]] } },
    { kind: "codeblock", language: "mermaid", code: "graph TD\n\n  A --> B" },
  ]);
});

test("lines that only look like a table stay text", () => {
  assert.deepEqual(parseDocument("| not a table"), [{ kind: "paragraph", text: "| not a table" }]);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Block } from "@topic-overview/core";

import { foldPath, innermost, outline, reveal, sectionOf, shownUnfolded, toggleFold } from "./outline.ts";

function block(id: string, text: string, children: Block[] = [], kind: Block["kind"] = "block"): Block {
  return { id, kind, text, properties: {}, children };
}
const heading = (id: string, text: string, children: Block[] = []) => block(id, text, children, "heading");

const PAGE = [
  heading("b1", "garden Title"),
  heading("b2", "Problem", [heading("b3", "Objectives", [block("b4", "O1: focus")]), block("b5", "loose text")]),
  heading("b6", "Solution", [block("b7", "a paragraph", [heading("b8", "Nested heading")])]),
];

test("the outline lists sections and the headings inside them", () => {
  assert.deepEqual(outline(PAGE), [
    { id: "b2", text: "Problem", depth: 0 },
    { id: "b3", text: "Objectives", depth: 1 },
    { id: "b6", text: "Solution", depth: 0 },
    { id: "b8", text: "Nested heading", depth: 1 },
  ]);
});

test("every block knows its section, and a block without children is none", () => {
  const owner = sectionOf(PAGE);
  assert.equal(owner.get("b4"), "b2");
  assert.equal(owner.get("b8"), "b6");
  assert.equal(owner.get("b6"), "b6");
  assert.equal(owner.has("b1"), false);
});

const page = [
  block("c", "Context", [
    heading("l", "Links", [block("l1", "Jira")]),
    heading("a", "Assets", [block("a1", "image", [block("a2", "detail")])]),
  ]),
  block("s", "Solution", [heading("p", "Approach", [block("p1", "Idea")])]),
];

test("the folds on the way to a block are its section and the headings around it", () => {
  assert.deepEqual(foldPath(page, "a2"), ["c", "a"]);
  assert.deepEqual(foldPath(page, "a"), ["c", "a"]);
  assert.equal(foldPath(page, "missing"), undefined);
});

test("a section opens whole, a heading opens alone, and choosing it again folds everything", () => {
  const context = toggleFold(page, new Set(), "c");
  assert.deepEqual([...shownUnfolded(page, context)].sort(), ["a", "c", "l"]);
  const assets = toggleFold(page, context, "a");
  assert.deepEqual([...shownUnfolded(page, assets)].sort(), ["a", "c"]);
  assert.deepEqual([...toggleFold(page, assets, "l")].sort(), ["c", "l"]);
  assert.deepEqual([...toggleFold(page, assets, "a")], []);
  assert.deepEqual([...toggleFold(page, context, "c")], []);
  assert.deepEqual([...toggleFold(page, assets, "p")].sort(), ["p", "s"]);
});

test("a jump unfolds the way to its block, and the innermost is what is open", () => {
  const open = reveal(page, "a2");
  assert.deepEqual([...open].sort(), ["a", "c"]);
  assert.equal(innermost(page, open), "a");
});

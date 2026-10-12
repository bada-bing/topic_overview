import assert from "node:assert/strict";
import { test } from "node:test";

import type { Block } from "@topic-overview/core";

import { foldPath, headingKeys, innermost, namedPlace, outline, placeName, reveal, sectionOf, shownUnfolded, toggleFold } from "./outline.ts";

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

test("a heading keeps its key when blocks are inserted above it, and its number does not matter", () => {
  const before = headingKeys(page);
  const after = headingKeys([block("x", "Metadata", [block("x1", "new")]), ...page.map((section) => ({ ...section, id: `${section.id}'` }))]);
  assert.equal(before.get("a"), ["Context", "Assets"].join("\u0000"));
  assert.equal([...after.values()].includes(before.get("p")!), true);
  assert.equal(before.has("a1"), false);
});

test("the URL names a heading by its id when it has one, and by its path otherwise", () => {
  const id = "0f3fe282-c1a3-434c-833a-9cfd9ae5a210";
  const tree = [block("b1", "Problem", [heading("b1.1", "🌗 Use Cases!", [block("b1.1.1", "U1")]), heading(id, "Objectives", [block("b1.2.1", "O1")])])];
  assert.equal(placeName(tree, "b1"), "problem");
  assert.equal(placeName(tree, "b1.1"), "problem/use-cases");
  assert.equal(placeName(tree, id), id);
  assert.equal(namedPlace(tree, "problem/use-cases"), "b1.1");
  assert.equal(namedPlace(tree, id), id);
  assert.equal(namedPlace(tree, "b1.1.1"), "b1.1.1");
  assert.equal(namedPlace(tree, "problem/gone"), undefined);
});

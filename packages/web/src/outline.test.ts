import assert from "node:assert/strict";
import { test } from "node:test";

import type { Block } from "@topic-overview/core";

import { outline, sectionOf } from "./outline.ts";

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

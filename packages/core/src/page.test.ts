import assert from "node:assert/strict";
import { test } from "node:test";

import { labels, pageLinks, parsePage, relations, sourceProblems } from "./page.ts";

const PAGE = parsePage(`- G1: Grow enough vegetables
  id:: b1
- R1: Water no more than twice a week
  id:: b2
- REQ1: Every bed gets six hours of sun (G1)
  id:: b3
- Move the beds (REQ1), see ((b2)), but not \`REQ9\` or REQ99
  id:: b4
`);

test("a numbered line carries its label", () => {
  assert.deepEqual([...labels(PAGE)], [["G1", "b1"], ["R1", "b2"], ["REQ1", "b3"]]);
});

test("a block relates to what it references and to the labels it mentions", () => {
  const related = relations(PAGE);
  assert.deepEqual([...related.get("b3")!], ["b1"]);
  assert.deepEqual([...related.get("b4")!].sort(), ["b2", "b3"]);
  assert.equal(related.has("b1"), false);
});

test("a page's links to other pages are found, but not inside code", () => {
  const page = parsePage("- see [[Seed catalogue]] and [[Tools/Spade]]\n  id:: a\n- not `[[Code]]`\n  id:: b\n");
  assert.deepEqual([...pageLinks(page)].sort(), ["Seed catalogue", "Tools/Spade"]);
});

test("a reference to a block not on the page is a problem, named by its block", () => {
  const page = parsePage("- Points at ((b2))\n  id:: b1\n- Here\n  id:: b2\n- Points at ((gone))\n  id:: b3\n");
  assert.deepEqual(sourceProblems(page), [
    { block: "b3", excerpt: "Points at ((gone))", reason: "references ((gone)), which is not on the page" },
  ]);
});

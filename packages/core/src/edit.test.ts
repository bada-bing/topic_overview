import assert from "node:assert/strict";
import { test } from "node:test";

import { deleteBlock, idAt, insertBlock, locate, moveBlock, ownText, replaceBlock, setId, setProperty, withOwnText } from "./edit.ts";
import { StoreError } from "./store.ts";

const O1 = "6a0f2c1e-0000-4000-8000-000000000001";
const O2 = "6a0f2c1e-0000-4000-8000-000000000002";
const PLANT = "6a0f2c1e-0000-4000-8000-000000000003";
const NEW = "6a0f2c1e-0000-4000-8000-000000000009";

const PAGE = `---
title: kept
---
- ## Problem
  background-color:: yellow
	- ### Objectives
		- O1: Grow beans
		  id:: ${O1}
		- O2: Grow peas
		  id:: ${O2}
	- ### Requirements
		- R1: Water daily, see ((${O2}))
- ## Solution
	- ### Approach
		- Plant in spring
		  and again in autumn
		  id:: ${PLANT}
		  collapsed:: true
			- in the north bed
`;

test("an id is given to the block at a line only when its first line reads as given", () => {
  const after = setId(PAGE, 12, "R1: Water daily, see ((" + O2 + "))", NEW);
  assert.equal(after, PAGE.replace(`see ((${O2}))\n`, `see ((${O2}))\n\t\t  id:: ${NEW}\n`));
  assert.throws(() => setId(PAGE, 12, "R1: Water weekly", NEW), /reads/);
  assert.throws(() => setId(PAGE, 13, "R1: Water daily", NEW), StoreError);
  assert.equal(idAt(PAGE, 7, "O1: Grow beans"), O1);
});

test("a replace changes the content and keeps the block's properties", () => {
  const after = replaceBlock(PAGE, PLANT, "- Plant in summer\n\t- in the south bed");
  assert.match(after, new RegExp(`\\t\\t- Plant in summer\\n\\t\\t  id:: ${PLANT}\\n\\t\\t  collapsed:: true\\n\\t\\t\\t- in the south bed\\n`));
  assert.doesNotMatch(after, /autumn|north/);
});

test("a replace that gives a property is refused", () => {
  assert.throws(() => replaceBlock(PAGE, O1, "- O1: Grow beans\n  id:: other"), /content only/);
});

test("a property is set, changed and removed, and the id is not one of them", () => {
  const set = setProperty(PAGE, O1, "status", "agreed");
  assert.match(set, new RegExp(`id:: ${O1}\\n\\t\\t  status:: agreed\\n`));
  assert.match(setProperty(set, O1, "status", "dropped"), /status:: dropped/);
  assert.equal(setProperty(set, O1, "status", undefined), PAGE);
  assert.throws(() => setProperty(PAGE, O1, "id", "x"), /set-id/);
});

test("a new block is inserted with its id, before, after or into another", () => {
  assert.match(insertBlock(PAGE, "before", O2, "- O3: Grow kale", NEW), new RegExp(`\\t\\t- O3: Grow kale\\n\\t\\t  id:: ${NEW}\\n\\t\\t- O2`));
  assert.match(insertBlock(PAGE, "into", PLANT, "- water at dawn", NEW), /\t\t\t- in the north bed\n\t\t\t- water at dawn\n/);
});

test("a move carries the block's own lines", () => {
  const after = moveBlock(PAGE, O2, "before", O1);
  assert.match(after, new RegExp(`\\t\\t- O2: Grow peas\\n\\t\\t  id:: ${O2}\\n\\t\\t- O1: Grow beans`));
  assert.equal(after.length, PAGE.length);
  assert.throws(() => moveBlock(PAGE, PLANT, "into", PLANT), /into itself/);
});

test("a block is deleted with everything under it, unless others refer to it", () => {
  assert.doesNotMatch(deleteBlock(PAGE, PLANT), /north/);
  assert.throws(() => deleteBlock(PAGE, O2), /reference broken/);
  assert.throws(() => deleteBlock(PAGE, NEW), /no block has the id/);
});

test("the view's block is found without lines, and its own text edited, leaving its children", () => {
  assert.deepEqual(locate(PAGE, "b1.1"), { line: 6, first: "### Objectives", id: undefined });
  assert.equal(ownText(PAGE, PLANT), "Plant in spring\nand again in autumn");
  const after = replaceBlock(PAGE, PLANT, withOwnText(PAGE, PLANT, "Plant in summer"));
  assert.match(after, new RegExp(`\\t\\t- Plant in summer\\n\\t\\t  id:: ${PLANT}\\n\\t\\t  collapsed:: true\\n\\t\\t\\t- in the north bed\\n`));
});

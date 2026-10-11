import assert from "node:assert/strict";
import { test } from "node:test";

import type { Block } from "@topic-overview/core";

import { reuse } from "./reuse.ts";

const block = (id: string, text: string, children: Block[] = []): Block => ({ id, kind: "block", text, properties: {}, children });

test("a block that did not change stays the same object, and one that did is new", () => {
  const before = [block("b1", "Context", [block("b1.1", "Links"), block("b1.2", "Assets")]), block("b2", "Problem")];
  const after = [block("b1", "Context", [block("b1.1", "Links"), block("b1.2", "Assets, changed")]), block("b2", "Problem")];
  const kept = reuse(before, after);
  assert.equal(kept[1], before[1]);
  assert.equal(kept[0].children[0], before[0].children[0]);
  assert.notEqual(kept[0].children[1], before[0].children[1]);
  assert.notEqual(kept[0], before[0]);
});

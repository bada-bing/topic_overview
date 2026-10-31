import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePage } from "@topic-overview/core/page";

import { taskHeader } from "./task.ts";

const PAGE = parsePage(`---
status: PENDING
phase: Implement the Solution
task_title: Plan the Garden
---
- # garden 🌗 Plan the Garden
  id:: b1
- ## Task Progress
  id:: b2
	- ### 🌗 Implement the Solution
	  id:: b3
		- DONE Define the Initial Action Plan
		  id:: b4
		- NOW Implement Initial Solution
		  id:: b5
- ## Solution
  id:: b6
	- ### Action Plan
	  id:: b7
		- DONE Set up the repository
		  id:: b8
		- NOW Add the column beside
		  id:: b9
			- NOW a sub-item is not a top-level item
			  id:: b10
		- WAITING Hear back about the seeds
		  id:: b11
`);

test("a task page's header says where the task stands", () => {
  assert.deepEqual(taskHeader(PAGE), {
    key: "garden",
    title: "Plan the Garden",
    status: "PENDING",
    phase: "Implement the Solution",
    steps: [{ id: "b5", text: "Implement Initial Solution", marker: "NOW" }],
    actions: [
      { id: "b9", text: "Add the column beside", marker: "NOW" },
      { id: "b11", text: "Hear back about the seeds", marker: "WAITING" },
    ],
  });
});

test("a page without a task_title has no task header", () => {
  assert.equal(taskHeader(parsePage("- # Notes\n  id:: a\n")), undefined);
});

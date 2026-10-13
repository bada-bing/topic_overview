import assert from "node:assert/strict";
import { test } from "node:test";

import { processAddress } from "./process.ts";

test("a process's address is split at its first colon, since a process name may hold one", () => {
  assert.deepEqual(processAddress("garden:dev:frontend"), { project: "garden", process: "dev:frontend" });
  assert.throws(() => processAddress("frontend"), /<project>:<process>/);
});

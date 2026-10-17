import assert from "node:assert/strict";
import { test } from "node:test";

import { parseActiveWork } from "./work.ts";

test("task work carries its key, step, NOW item and elapsed time", () => {
  assert.deepEqual(parseActiveWork("task\tWFC-1144\tImplement Initial Solution\tAdd the button\n", "1:05\n"), {
    kind: "task",
    identity: "WFC-1144",
    step: "Implement Initial Solution",
    now: "Add the button",
    elapsed: "1:05",
  });
});

test("an adhoc is its label, and nothing recorded is none without an elapsed time", () => {
  assert.deepEqual(parseActiveWork("adhoc\tPay the rent\t\t\n", "0:10"), { kind: "adhoc", identity: "Pay the rent", elapsed: "0:10" });
  assert.deepEqual(parseActiveWork("none\t\t\t\n", ""), { kind: "none" });
  assert.deepEqual(parseActiveWork("unlabelled\t\t\t", "2:30"), { kind: "unlabelled", elapsed: "2:30" });
});

test("a kind the scripts do not print is read as none", () => {
  assert.deepEqual(parseActiveWork("whatever\tx\t\t", ""), { kind: "none", identity: "x" });
});

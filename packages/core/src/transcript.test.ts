import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeTranscript, parseTranscript, parseTranscriptLine } from "./transcript.ts";

const line = (entry: object) => JSON.stringify(entry);

test("what I typed, what the agent replied and what it called are read", () => {
  const text = [
    line({ type: "user", uuid: "u1", timestamp: "t1", message: { role: "user", content: "Fix the build\n<system-reminder>ignored</system-reminder>" } }),
    line({ type: "assistant", uuid: "a1", timestamp: "t2", message: { role: "assistant", content: [{ type: "thinking", thinking: "" }] } }),
    line({ type: "assistant", uuid: "a2", timestamp: "t3", message: { role: "assistant", content: [{ type: "text", text: "On it." }] } }),
    line({
      type: "assistant",
      uuid: "a3",
      timestamp: "t4",
      message: { role: "assistant", content: [{ type: "tool_use", id: "tool1", name: "Bash", input: { command: "pnpm test", description: "Run the tests" } }] },
    }),
    line({
      type: "user",
      uuid: "u2",
      timestamp: "t5",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tool1", content: "all green", is_error: false }] },
    }),
  ].join("\n");
  assert.deepEqual(parseTranscript(text), [
    { kind: "prompt", id: "u1", at: "t1", text: "Fix the build" },
    { kind: "reply", id: "a2", at: "t3", text: "On it." },
    {
      kind: "tool",
      id: "tool1",
      at: "t4",
      name: "Bash",
      summary: "Run the tests",
      input: '{\n  "command": "pnpm test",\n  "description": "Run the tests"\n}',
      result: "all green",
      failed: false,
    },
  ]);
});

test("what is not part of the conversation, or of a shape not known, is skipped", () => {
  assert.deepEqual(parseTranscriptLine(line({ type: "user", isMeta: true, message: { content: [{ type: "text", text: "a skill" }] } })), []);
  assert.deepEqual(parseTranscriptLine(line({ type: "assistant", isSidechain: true, message: { content: [{ type: "text", text: "a subagent" }] } })), []);
  assert.deepEqual(parseTranscriptLine(line({ type: "api-request", params: {} })), []);
  assert.deepEqual(parseTranscriptLine(line({ type: "system", subtype: "local_command", content: "/model" })), []);
  assert.deepEqual(parseTranscriptLine("not json"), []);
});

test("pasted text is shown as the text", () => {
  const entry = parseTranscriptLine(line({ type: "user", uuid: "u", timestamp: "t", message: { content: '<pasted_content id="x">pasted</pasted_content id="x">' } }));
  assert.deepEqual(entry, [{ kind: "prompt", id: "u", at: "t", text: "pasted" }]);
});

test("a result is merged into its call, and an entry read again is not added twice", () => {
  const call = parseTranscriptLine(line({ type: "assistant", uuid: "a", timestamp: "t", message: { content: [{ type: "tool_use", id: "tool1", name: "Read", input: { file_path: "a.ts" } }] } }));
  const result = parseTranscriptLine(line({ type: "user", uuid: "u", timestamp: "t2", message: { content: [{ type: "tool_result", tool_use_id: "tool1", content: [{ type: "text", text: "the file" }], is_error: true }] } }));
  const merged = mergeTranscript(mergeTranscript([], call), [...result, ...call]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], { kind: "tool", id: "tool1", at: "t", name: "Read", summary: "a.ts", input: "a.ts", result: "the file", failed: true });
  assert.deepEqual(mergeTranscript([], result), []);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInline, parseText, splitMarker } from "./inline.ts";

test("inline markdown is split into its pieces", () => {
  assert.deepEqual(parseInline("**Scope**: see [[seed-catalogue]] and ((b7)), `code`, *soft*"), [
    { kind: "bold", text: "Scope" },
    { kind: "text", text: ": see " },
    { kind: "page", name: "seed-catalogue" },
    { kind: "text", text: " and " },
    { kind: "reference", id: "b7" },
    { kind: "text", text: ", " },
    { kind: "code", text: "code" },
    { kind: "text", text: ", " },
    { kind: "italic", text: "soft" },
  ]);
});

test("a reference inside code stays code", () => {
  assert.deepEqual(parseInline("write `((b7))`"), [
    { kind: "text", text: "write " },
    { kind: "code", text: "((b7))" },
  ]);
});

test("links are recognised with and without a label", () => {
  assert.deepEqual(parseInline("[the prototype](https://claude.ai/x) or https://example.com/y"), [
    { kind: "link", text: "the prototype", href: "https://claude.ai/x" },
    { kind: "text", text: " or " },
    { kind: "link", text: "https://example.com/y", href: "https://example.com/y" },
  ]);
});

test("a fenced code block is kept apart from the text around it", () => {
  const parts = parseText("Run this:\n```sh\nls -la\n```\nthen look");
  assert.deepEqual(parts, [
    { kind: "inline", inlines: [{ kind: "text", text: "Run this:" }] },
    { kind: "codeblock", language: "sh", code: "ls -la" },
    { kind: "inline", inlines: [{ kind: "text", text: "then look" }] },
  ]);
});

test("a task marker is taken off the front of a block", () => {
  assert.deepEqual(splitMarker("NOW Define the Problem Statement"), { marker: "NOW", text: "Define the Problem Statement" });
  assert.deepEqual(splitMarker("NOWHERE else"), { text: "NOWHERE else" });
});

test("an image is told from a link", () => {
  assert.deepEqual(parseInline("![plan](../assets/plan_1.png) and [docs](https://example.com)"), [
    { kind: "image", alt: "plan", src: "../assets/plan_1.png" },
    { kind: "text", text: " and " },
    { kind: "link", text: "docs", href: "https://example.com" },
  ]);
});

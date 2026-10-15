import assert from "node:assert/strict";
import { test } from "node:test";

import { assetName, assetSource, assetsIn, documentAsset, isDocument } from "./asset.ts";

test("an image of the knowledge base is fetched through the server, a full URL as it is", () => {
  assert.equal(assetSource("../assets/plan 1.png", "/api/topics/K/assets"), "/api/topics/K/assets/plan%201.png");
  assert.equal(assetSource("https://example.com/a.png", undefined), "https://example.com/a.png");
  assert.equal(assetSource("../assets/plan.png", undefined), undefined);
  assert.equal(assetSource("../pages/other.md", "/api/topics/K/assets"), undefined);
});

test("a link to a markdown file of the assets is a document, named by its text or its file", () => {
  assert.deepEqual(assetsIn("the [plan](../assets/csp_plan.md) and [docs](https://example.com/a.md)"), [
    { kind: "document", name: "plan", src: "../assets/csp_plan.md" },
  ]);
  assert.equal(assetName(documentAsset("../assets/violations%20table.md", "../assets/violations%20table.md")), "violations table.md");
  assert.equal(isDocument("../pages/other.md"), false);
  assert.equal(assetSource("../assets/csp_plan.md", "/api/topics/K/assets"), "/api/topics/K/assets/csp_plan.md");
});

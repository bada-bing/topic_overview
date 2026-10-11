import assert from "node:assert/strict";
import { test } from "node:test";

import { imageSource } from "./asset.ts";

test("an image of the knowledge base is fetched through the server, a full URL as it is", () => {
  assert.equal(imageSource("../assets/plan 1.png", "/api/topics/K/assets"), "/api/topics/K/assets/plan%201.png");
  assert.equal(imageSource("https://example.com/a.png", undefined), "https://example.com/a.png");
  assert.equal(imageSource("../assets/plan.png", undefined), undefined);
  assert.equal(imageSource("../pages/other.md", "/api/topics/K/assets"), undefined);
});

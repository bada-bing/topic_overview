import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { blocksElsewhere } from "./elsewhere.ts";

const SEEDS = "6a0f2c1e-0000-4000-8000-0000000000a1";
const WATERING = "6a0f2c1e-0000-4000-8000-0000000000a2";
const LATER = "6a0f2c1e-0000-4000-8000-0000000000a3";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "elsewhere-"));
  await mkdir(join(root, "pages"));
  await mkdir(join(root, "journals"));
  await writeFile(
    join(root, "pages", "Garden%2FBeds.md"),
    `- Seed list\n  id:: ${SEEDS}\n\t- beans\n\t- peas\n- Other\n`,
  );
  await writeFile(join(root, "journals", "2026_10_14.md"), `- Water the beds\n  id:: ${WATERING}\n`);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("a block is found by its id on another page or a journal, with its page and what is under it", async () => {
  const found = await blocksElsewhere(root, [SEEDS, WATERING, "nowhere"]);
  assert.deepEqual(Object.keys(found).sort(), [SEEDS, WATERING].sort());
  assert.equal(found[SEEDS].page, "Garden/Beds");
  assert.equal(found[SEEDS].journal, false);
  assert.equal(found[SEEDS].block.text, "Seed list");
  assert.deepEqual(found[SEEDS].block.children.map((child) => child.text), ["beans", "peas"]);
  assert.deepEqual({ page: found[WATERING].page, journal: found[WATERING].journal }, { page: "2026-10-14", journal: true });
});

test("a page changed since it was read is read again, and a removed one is forgotten", async () => {
  assert.deepEqual(await blocksElsewhere(root, [LATER]), {});
  const file = join(root, "pages", "Garden%2FBeds.md");
  await writeFile(file, `- Seed list\n  id:: ${SEEDS}\n- Sow later\n  id:: ${LATER}\n`);
  const later = new Date(Date.now() + 5_000);
  await utimes(file, later, later);
  assert.equal((await blocksElsewhere(root, [LATER]))[LATER]?.block.text, "Sow later");
  await rm(file);
  assert.deepEqual(await blocksElsewhere(root, [SEEDS]), {});
});

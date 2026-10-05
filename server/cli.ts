// The commands an agent runs to open, resume and close a discussion.
//
//   topic open <source> <logseq-page.md> [--session <id>]
//   topic resume <source> --session <id>
//   topic close <source> [--session <id>]

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";

import { convertLogseq } from "./logseq.ts";
import { claudeSession } from "./sessions.ts";
import { type DiscussionRef, Store, StoreError } from "./store.ts";

const PAGE_URL = "http://127.0.0.1:5173/d";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { session: { type: "string" } },
});
const [command, source, path] = positionals;
const store = new Store(process.env.TOPIC_OVERVIEW_DISCUSSIONS);
const session = values.session ? claudeSession(values.session, process.env.INIT_CWD ?? process.cwd()) : undefined;

function url(ref: DiscussionRef): string {
  return `${PAGE_URL}/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.startedAt)}`;
}

async function main(): Promise<void> {
  switch (command) {
    case "open": {
      if (!source || !path) throw new StoreError("usage: topic open <source> <logseq-page.md> [--session <id>]");
      const pageMd = convertLogseq(await readFile(path, "utf8"));
      const ref = await store.open(source, path, pageMd, session);
      console.log(`opened ${basename(path)} as ${ref.source}/${ref.startedAt}\n${url(ref)}`);
      return;
    }
    case "resume": {
      if (!source || !session) throw new StoreError("usage: topic resume <source> --session <id>");
      const ref = await store.resume(source, session);
      const { discussion } = await store.read(ref);
      console.log(`${url(ref)}\nversion ${discussion.version}, ${discussion.annotations.length} open comments`);
      return;
    }
    case "close": {
      const ref = source ? await store.openDiscussionOf(source) : undefined;
      if (!ref) throw new StoreError(`there is no open discussion of ${source}`);
      await store.close(ref, session);
      console.log(`closed ${ref.source}/${ref.startedAt}`);
      return;
    }
    default:
      throw new StoreError("usage: topic open|resume|close <source> ...");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof StoreError ? error.message : error);
  process.exit(1);
});

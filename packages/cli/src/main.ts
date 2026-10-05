// topic: the commands run on discussions. Each command is a file in
// commands/, named after its verb.

import { parseArgs } from "node:util";

import { StoreError } from "@topic-overview/core";

import { close } from "./commands/close.ts";
import { open } from "./commands/open.ts";
import { resume } from "./commands/resume.ts";
import { type Context, context } from "./context.ts";

const COMMANDS: Record<string, (args: string[], context: Context) => Promise<void>> = {
  open,
  resume,
  close,
};

const { positionals, values } = parseArgs({ allowPositionals: true, options: { session: { type: "string" } } });
const [verb, ...args] = positionals;
const command = verb ? COMMANDS[verb] : undefined;

if (!command) {
  console.error(`usage: topic <${Object.keys(COMMANDS).join("|")}> ...`);
  process.exit(1);
}

command(args, context(values.session)).catch((error: unknown) => {
  console.error(error instanceof StoreError ? error.message : error);
  process.exit(1);
});

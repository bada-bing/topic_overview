// topic: the commands run on discussions. Each command is a file in
// commands/, named after its verb.

import { parseArgs } from "node:util";

import { StoreError } from "@topic-overview/core";

import { close } from "./commands/close.ts";
import { remove } from "./commands/delete.ts";
import { insert } from "./commands/insert.ts";
import { integration } from "./commands/integration.ts";
import { list } from "./commands/list.ts";
import { move } from "./commands/move.ts";
import { open } from "./commands/open.ts";
import { replace } from "./commands/replace.ts";
import { resume } from "./commands/resume.ts";
import { setId } from "./commands/set-id.ts";
import { setPropertyCommand } from "./commands/set-property.ts";
import { save } from "./commands/save.ts";
import { status } from "./commands/status.ts";
import { type Context, context } from "./context.ts";

const COMMANDS: Record<string, (args: string[], context: Context) => Promise<void>> = {
  open,
  resume,
  close,
  save,
  list,
  status,
  integration,
  replace,
  insert,
  move,
  delete: remove,
  "set-id": setId,
  "set-property": setPropertyCommand,
};

// The arguments, or the reason they could not be read, such as an option
// given no value, said without a stack trace.
function readArgs() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        session: { type: "string" },
        from: { type: "string" },
        label: { type: "string" },
        after: { type: "string" },
        before: { type: "string" },
        into: { type: "string" },
        line: { type: "string" },
        text: { type: "string" },
        nil: { type: "boolean" },
      },
    });
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

const { positionals, values } = readArgs();
const [verb, ...args] = positionals;

const command = verb ? COMMANDS[verb] : undefined;

if (!command) {
  console.error(`usage: topic <${Object.keys(COMMANDS).join("|")}> ...`);
  process.exit(1);
}

Promise.resolve()
  .then(() => command(args, context(values.session, values.from, values.label, { after: values.after, before: values.before, into: values.into }, { line: values.line, text: values.text, nil: values.nil })))
  .catch((error: unknown) => {
    console.error(error instanceof StoreError ? error.message : error);
    process.exit(1);
  });

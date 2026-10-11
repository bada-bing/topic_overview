// topic set-property <key> <id> <name> <value>
// topic set-property <key> <id> <name> --nil
// Sets one of a block's own properties, or removes it with --nil. Its
// content stays as it is; that is changed with replace.

import { StoreError, Topics, setProperty } from "@topic-overview/core";

import { type Context, need } from "../context.ts";

const USAGE = "topic set-property <key> <id> <name> <value>|--nil";

export async function setPropertyCommand([key, id, name, value]: string[], context: Context): Promise<void> {
  const block = need(id, USAGE);
  const property = need(name, USAGE);
  if (context.nil === (value !== undefined)) throw new StoreError(`usage: ${USAGE}`);
  const set = context.nil ? undefined : value;
  const topics = new Topics();
  const topic = need(key, USAGE);
  const named = await topics.blockName(topic, block);
  const description = context.nil ? `Remove ${property} from ${named}` : `Set ${property} on ${named}`;
  const head = await topics.change(topic, description, (text) => setProperty(text, block, property, set), {
    id: block,
    kind: "changed",
  });
  console.log(`${context.nil ? "removed" : "set"} ${property} at ${head}`);
}

// topic integration add <key> <local|cluster|jenkins> <reference> [--label <text>]
// topic integration remove <key> <id>
// What a discussion depends on outside its source, as the agent or I decide:
// a local process, `<project>:<process>`; a deployment in a cluster,
// `context/namespace/deployment`; or a Jenkins build, `job#number`. The
// view shows each with its state.

import { Topics } from "@topic-overview/core";

import { type Context, need } from "../context.ts";

const USAGE = "topic integration add <key> <local|cluster|jenkins> <reference> [--label <text>] | remove <key> <id>";

export async function integration([verb, key, ...rest]: string[], context: Context): Promise<void> {
  if (verb === "add") {
    const [kind, reference] = rest;
    const added = await new Topics().addIntegration(need(key, USAGE), need(kind, USAGE), need(reference, USAGE), context.label);
    console.log(added.id);
    return;
  }
  if (verb === "remove") {
    await new Topics().removeIntegration(need(key, USAGE), need(rest[0], USAGE));
    console.log(`removed ${rest[0]}`);
    return;
  }
  need(undefined, USAGE);
}

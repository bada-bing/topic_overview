// topic integration add <source> <kind> <reference> [--label <text>] [--session <id>]
// topic integration remove <source> <id> [--session <id>]
// What the open discussion of a source depends on outside it: a local
// process, a deployment in a cluster, or a Jenkins job.

import { INTEGRATION_KINDS } from "@topic-overview/core";

import { type Context, need, openDiscussion } from "../context.ts";

const USAGE = `topic integration add <source> <${INTEGRATION_KINDS.join("|")}> <reference> [--label <text>] | remove <source> <id>`;

export async function integration([verb, source, ...rest]: string[], context: Context): Promise<void> {
  const ref = await openDiscussion(context, need(source, USAGE));
  if (verb === "add") {
    const [kind, reference] = rest;
    const added = await context.store.addIntegration(ref, need(kind, USAGE), need(reference, USAGE), context.label, context.session);
    console.log(`${added.id}: ${added.kind} ${added.reference}`);
    return;
  }
  if (verb === "remove") {
    await context.store.removeIntegration(ref, need(rest[0], USAGE), context.session);
    console.log(`removed ${rest[0]}`);
    return;
  }
  need(undefined, USAGE);
}

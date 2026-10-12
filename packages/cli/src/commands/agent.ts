// topic agent <key> <session>[:<window>]
// Moves a discussion to another agent: the tmux session, and the window in
// it when not its first. Asking, the agent's state and the view's buttons
// follow it from then on.

import { StoreError, Topics } from "@topic-overview/core";

import { type Context, need } from "../context.ts";

const USAGE = "topic agent <key> <session>[:<window>]";

export async function agent([key, where]: string[], _context: Context): Promise<void> {
  const [session, window] = need(where, USAGE).split(":");
  if (!session) throw new StoreError(`usage: ${USAGE}`);
  await new Topics().setAgent(need(key, USAGE), window ? { session, window } : { session });
  console.log(`${key}'s agent is the ${window ? `window ${window}` : "first window"} of ${session}`);
}

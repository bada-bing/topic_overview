// topic close <key> [--discard]
// Closes a discussion into main: main merged one last time, the ids the tool
// gave removed unless something refers to them, and the branch squashed into
// one commit on main. A discussion that changed nothing makes no commit.
// With --discard nothing is merged. Either way the worktree, the branch and
// the discussion's state are removed.

import { Topics } from "@topic-overview/core";

import { type Context, need } from "../context.ts";

const USAGE = "topic close <key> [--discard]";

export async function close([key]: string[], context: Context): Promise<void> {
  const topics = new Topics();
  const given = need(key, USAGE);
  if (context.discard) {
    await topics.discard(given);
    console.log(`discarded ${given}; main is as it was`);
    return;
  }
  const { commit, subject } = await topics.close(given);
  if (!commit) console.log(`closed ${given}; it changed nothing, so main is as it was`);
  else console.log(`closed ${given} into main at ${commit}${subject ? ` ${subject}` : ""}`);
}

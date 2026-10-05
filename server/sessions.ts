import { homedir } from "node:os";
import { join } from "node:path";

import type { SessionInfo } from "./store.ts";

// Claude Code keeps a session's transcript under the directory the session
// runs in, with every character other than a letter or digit written as `-`.
export function claudeSession(id: string, cwd: string = process.cwd()): SessionInfo {
  const project = cwd.replace(/[^A-Za-z0-9]/g, "-");
  return { id, transcript: join(homedir(), ".claude/projects", project, `${id}.jsonl`) };
}

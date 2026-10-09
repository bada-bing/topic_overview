import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { SessionInfo } from "./store.ts";

// Claude Code keeps a session's transcript as `<id>.jsonl` in a folder named
// after the directory the session runs in. The transcript is looked up by its
// id, so it is found wherever the command is run from; the folder of the
// directory given is the fallback, for a session whose transcript is not
// written yet.
export function claudeSession(id: string, cwd: string = process.cwd(), projects = join(homedir(), ".claude/projects")): SessionInfo {
  const file = `${id}.jsonl`;
  const folders = existsSync(projects) ? readdirSync(projects) : [];
  const found = folders.find((folder) => existsSync(join(projects, folder, file)));
  const folder = found ?? cwd.replace(/[^A-Za-z0-9]/g, "-");
  return { id, transcript: join(projects, folder, file) };
}

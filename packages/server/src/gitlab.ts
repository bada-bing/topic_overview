// The state of a GitLab merge request a page links to, asked through glab and
// its own login. Only the hosts TOPIC_OVERVIEW_GITLAB_HOSTS lists are asked.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const LINK = /^https:\/\/([^/]+)\/(.+?)\/-\/merge_requests\/(\d+)\/?$/;
const TIMEOUT = 8_000;
// A state is asked again after a minute, so a merge shows without a restart.
const KEEP = 60_000;

export class GitlabError extends Error {}
// GitLab gave no answer: not reachable, too slow, or glab not logged in.
export class GitlabUnreachable extends Error {}

export interface MergeRequestState {
  state: "opened" | "merged" | "closed" | "locked";
  draft: boolean;
}

const known = new Map<string, { at: number; state: MergeRequestState }>();

function allowedHosts(): Set<string> {
  return new Set(
    (process.env.TOPIC_OVERVIEW_GITLAB_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  );
}

export async function mergeRequestState(url: string): Promise<MergeRequestState> {
  const link = LINK.exec(url);
  if (!link) throw new GitlabError("not a merge request link");
  const [, host, project, number] = link;
  if (!allowedHosts().has(host)) throw new GitlabError(`${host} is not a configured GitLab host`);

  const cached = known.get(url);
  if (cached && Date.now() - cached.at < KEEP) return cached.state;

  let answer: { state: MergeRequestState["state"]; draft?: boolean };
  try {
    const { stdout } = await run(
      "glab",
      ["api", "--hostname", host, `projects/${encodeURIComponent(project)}/merge_requests/${number}`],
      { timeout: TIMEOUT },
    );
    answer = JSON.parse(stdout);
  } catch {
    throw new GitlabUnreachable(`${host} did not answer`);
  }
  const state = { state: answer.state, draft: answer.draft ?? false };
  known.set(url, { at: Date.now(), state });
  return state;
}

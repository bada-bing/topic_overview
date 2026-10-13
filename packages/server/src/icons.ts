// The icon of a system an integration lives on, such as a GitLab host's,
// fetched once from its origin and kept in a local cache, so the page shows
// it without asking the system again, even when the system cannot be reached.
// Only the origins the configuration names are fetched: the GitLab hosts
// TOPIC_OVERVIEW_GITLAB_HOSTS lists and TOPIC_OVERVIEW_JENKINS_URL. The cache
// is TOPIC_OVERVIEW_CACHE, or ~/.cache/topic-overview, outside the repository.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { StoreError } from "@topic-overview/core";

const TIMEOUT = 8_000;

export interface Icon {
  type: string;
  body: Buffer;
}

function cacheRoot(): string {
  const configured = process.env.TOPIC_OVERVIEW_CACHE;
  if (!configured) return join(homedir(), ".cache", "topic-overview");
  return configured.startsWith("~/") ? join(homedir(), configured.slice(2)) : configured;
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const host of (process.env.TOPIC_OVERVIEW_GITLAB_HOSTS ?? "").split(",")) {
    if (host.trim()) origins.add(`https://${host.trim()}`);
  }
  const jenkins = process.env.TOPIC_OVERVIEW_JENKINS_URL;
  if (jenkins) origins.add(new URL(jenkins).origin);
  return origins;
}

const known = new Map<string, Icon>();

export async function iconOf(origin: string): Promise<Icon> {
  if (!allowedOrigins().has(origin)) throw new StoreError(`${origin} is not a configured system`);
  const kept = known.get(origin);
  if (kept) return kept;
  const file = join(cacheRoot(), "icons", new URL(origin).host);
  const cached = await Promise.all([readFile(file), readFile(`${file}.type`, "utf8")]).catch(() => undefined);
  if (cached) {
    const icon = { body: cached[0], type: cached[1] };
    known.set(origin, icon);
    return icon;
  }
  const response = await fetch(`${origin}/favicon.ico`, { signal: AbortSignal.timeout(TIMEOUT) }).catch(() => undefined);
  const type = response?.headers.get("content-type") ?? "";
  if (!response?.ok || !type.startsWith("image/")) throw new StoreError(`${origin} gave no icon`);
  const icon = { body: Buffer.from(await response.arrayBuffer()), type };
  await mkdir(join(cacheRoot(), "icons"), { recursive: true });
  await writeFile(file, icon.body);
  await writeFile(`${file}.type`, type);
  known.set(origin, icon);
  return icon;
}

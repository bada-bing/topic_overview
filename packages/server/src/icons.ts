// The icon of a system an integration lives on, such as a GitLab host's,
// fetched once from its origin and kept in a local cache, so the page shows
// it without asking the system again, even when the system cannot be reached.
// Only the origins the configuration names are fetched: the GitLab hosts
// TOPIC_OVERVIEW_GITLAB_HOSTS lists, TOPIC_OVERVIEW_JENKINS_URL, and the
// Google Cloud console when a context in TOPIC_OVERVIEW_KUBE_CONTEXTS is a
// GKE cluster's. The cache
// is TOPIC_OVERVIEW_CACHE, or ~/.cache/topic-overview, outside the repository.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { StoreError, kubeContexts } from "@topic-overview/core";

const run = promisify(execFile);
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
  if ([...kubeContexts().keys()].some((context) => context.startsWith("gke_"))) origins.add("https://console.cloud.google.com");
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

// The icon of an app the configuration names: the terminal,
// TOPIC_OVERVIEW_TERMINAL, where a local process's window is brought up, or
// the browser, TOPIC_OVERVIEW_BROWSER, where a page's tab is. It is read
// from the installed app, as the file its Info.plist names, and converted
// to PNG with macOS's sips, so nothing is fetched. It is kept in the cache
// like the systems' icons.
const APPS: Record<string, string> = { terminal: "TOPIC_OVERVIEW_TERMINAL", browser: "TOPIC_OVERVIEW_BROWSER" };

export async function appIcon(which: string): Promise<Icon> {
  const name = APPS[which] ? process.env[APPS[which]] : undefined;
  if (!name) throw new StoreError(`no ${which} app is configured`);
  const kept = known.get(`app:${name}`);
  if (kept) return kept;
  const file = join(cacheRoot(), "icons", `${name}.app.png`);
  const cached = await readFile(file).catch(() => undefined);
  if (!cached) {
    const app = ["/Applications", join(homedir(), "Applications"), "/System/Applications"]
      .map((folder) => join(folder, `${name}.app`))
      .find((path) => existsSync(path));
    if (!app) throw new StoreError(`${name} is not installed`);
    const plist = join(app, "Contents", "Info.plist");
    const { stdout } = await run("plutil", ["-extract", "CFBundleIconFile", "raw", plist]).catch(() => ({ stdout: "" }));
    const named = stdout.trim();
    if (!named) throw new StoreError(`${name} names no icon`);
    const icns = join(app, "Contents", "Resources", named.endsWith(".icns") ? named : `${named}.icns`);
    await mkdir(join(cacheRoot(), "icons"), { recursive: true });
    await run("sips", ["-s", "format", "png", "-Z", "64", icns, "--out", file]);
    // An app icon is drawn with a margin of about a tenth on each side, by
    // Apple's template, which would show it smaller than the systems' icons.
    await run("sips", ["-c", "52", "52", file]);
  }
  const icon = { body: cached ?? (await readFile(file)), type: "image/png" };
  known.set(`app:${name}`, icon);
  return icon;
}

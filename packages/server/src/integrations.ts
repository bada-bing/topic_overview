// The state of a discussion's integrations, asked of the system each names:
// GitLab for a merge request, tmux for a local process, kubectl for a
// deployment, Jenkins' API for a job.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { type Integration, processAddress, processState } from "@topic-overview/core";

import { GitlabError, mergeRequestState } from "./gitlab.ts";

const run = promisify(execFile);

export interface IntegrationState {
  id: string;
  state: string; // such as running, exited, not started, unknown
  detail?: string;
  url?: string; // where to look at it, such as a build in Jenkins
}

// A merge request is asked of GitLab, on the hosts TOPIC_OVERVIEW_GITLAB_HOSTS
// lists; an open one that is a draft says so. What the page says it does
// stays its detail, and a GitLab that cannot be asked says so in the state.
async function mergeRequest(integration: Integration): Promise<IntegrationState> {
  const shown = { id: integration.id, url: integration.reference, ...(integration.detail ? { detail: integration.detail } : {}) };
  try {
    const { state, draft } = await mergeRequestState(integration.reference);
    return { ...shown, state: state === "opened" ? (draft ? "draft" : "open") : state };
  } catch (failure) {
    return { ...shown, state: failure instanceof GitlabError ? "not asked" : "not reachable" };
  }
}

// A local integration is a process of the process manager, named
// project:process. What it printed is read in its window.
async function localState(integration: Integration): Promise<IntegrationState> {
  try {
    return { id: integration.id, state: await processState(processAddress(integration.reference)) };
  } catch (failure) {
    return { id: integration.id, state: "unknown", detail: (failure as Error).message };
  }
}

function configured(variable: string): Set<string> {
  return new Set(
    (process.env[variable] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

interface DeploymentStatus {
  metadata: { generation: number };
  spec: { replicas?: number; template: { spec: { containers: { image: string }[] } } };
  status: { readyReplicas?: number; updatedReplicas?: number; observedGeneration?: number };
}

// A cluster integration is a deployment, named context/namespace/deployment.
// Only the contexts TOPIC_OVERVIEW_KUBE_CONTEXTS lists are asked, read-only.
async function clusterState(integration: Integration): Promise<IntegrationState> {
  const [context, namespace, name] = integration.reference.split("/");
  if (!context || !namespace || !name) {
    return { id: integration.id, state: "unknown", detail: "a cluster reference is context/namespace/deployment" };
  }
  if (!configured("TOPIC_OVERVIEW_KUBE_CONTEXTS").has(context)) {
    return { id: integration.id, state: "unknown", detail: `${context} is not a configured context` };
  }
  let deployment: DeploymentStatus;
  try {
    const { stdout } = await run(
      "kubectl",
      ["--context", context, "--request-timeout=8s", "-n", namespace, "get", "deployment", name, "-o", "json"],
      { timeout: 12_000 },
    );
    deployment = JSON.parse(stdout);
  } catch {
    return { id: integration.id, state: "unknown", detail: `${context} did not answer` };
  }
  const wanted = deployment.spec.replicas ?? 1;
  const ready = deployment.status.readyReplicas ?? 0;
  const updated = deployment.status.updatedReplicas ?? 0;
  const tag = deployment.spec.template.spec.containers[0]?.image.split(":").pop() ?? "";
  const rolling = (deployment.status.observedGeneration ?? 0) < deployment.metadata.generation || updated < wanted;
  const state = ready === 0 && wanted > 0 ? "unavailable" : rolling || ready < wanted ? "rolling out" : "ready";
  return { id: integration.id, state, detail: `${ready}/${wanted} ready · ${tag}` };
}

interface Build {
  result: string | null;
  building: boolean;
  timestamp: number;
}

function ago(time: number): string {
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

// A jenkins integration is a build the agent started, written job#number;
// folders are written folder/job. The server asked is
// TOPIC_OVERVIEW_JENKINS_URL, as TOPIC_OVERVIEW_JENKINS_USER, with the token
// in TOPIC_OVERVIEW_JENKINS_TOKEN or else JENKINS_API_TOKEN. A finished build
// cannot change, so Jenkins' answer is kept and not asked again; only how
// long ago it ran moves on.
const finished = new Map<string, Build>();

async function jenkinsState(integration: Integration): Promise<IntegrationState> {
  const base = process.env.TOPIC_OVERVIEW_JENKINS_URL?.replace(/\/$/, "");
  const user = process.env.TOPIC_OVERVIEW_JENKINS_USER;
  const token = process.env.TOPIC_OVERVIEW_JENKINS_TOKEN ?? process.env.JENKINS_API_TOKEN;
  if (!base || !user || !token) return { id: integration.id, state: "unknown", detail: "no Jenkins server is configured" };
  const [job, number] = integration.reference.split("#");
  const path = job
    .split("/")
    .map((part) => `job/${encodeURIComponent(part.trim())}`)
    .join("/");
  const url = `${base}/${path}/${number}/`;
  let build = finished.get(integration.reference);
  if (!build) {
    try {
      const response = await fetch(`${url}api/json?tree=result,building,timestamp`, {
        headers: { authorization: `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 404) return { id: integration.id, state: "unknown", detail: "no such job or build" };
      if (!response.ok) return { id: integration.id, state: "unknown", detail: `Jenkins answered ${response.status}` };
      build = (await response.json()) as Build;
    } catch {
      return { id: integration.id, state: "unknown", detail: "Jenkins did not answer" };
    }
    if (!build.building && build.result) finished.set(integration.reference, build);
  }
  return {
    id: integration.id,
    state: build.building ? "building" : (build.result ?? "unknown").toLowerCase().replace("_", " "),
    detail: `${build.building ? "started" : "ran"} ${ago(build.timestamp)}`,
    url,
  };
}

// How often each kind is asked while a page is open: local processes are
// cheap, a cluster is asked over the network, and GitLab's answer is kept
// for a minute.
export const INTERVALS: Record<Integration["kind"], number> = {
  "merge-request": 60_000,
  local: 5_000,
  cluster: 30_000,
  jenkins: 60_000,
};

export async function integrationState(integration: Integration): Promise<IntegrationState> {
  if (integration.kind === "merge-request") return mergeRequest(integration);
  if (integration.kind === "local") return localState(integration);
  if (integration.kind === "cluster") return clusterState(integration);
  return jenkinsState(integration);
}

export async function integrationStates(integrations: Integration[]): Promise<IntegrationState[]> {
  return Promise.all(integrations.map(integrationState));
}

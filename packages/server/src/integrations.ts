// The state of a discussion's integrations, asked of the system each names.
// Local processes and cluster deployments are asked; Jenkins jobs say so.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Integration } from "@topic-overview/core";

const run = promisify(execFile);

export interface IntegrationState {
  id: string;
  state: string; // running, exited, not started, unknown
  detail?: string;
}

// A local integration is a process of the process manager, named
// project:process. It runs in a tmux window of that name, whose pane the
// process manager marks running or exited.
async function localState(integration: Integration): Promise<IntegrationState> {
  try {
    const { stdout } = await run("tmux", ["display-message", "-p", "-t", integration.reference, "#{@proc_state}"]);
    const state = stdout.trim();
    return { id: integration.id, state: state || "not started" };
  } catch {
    return { id: integration.id, state: "not started", detail: `no window ${integration.reference}` };
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

// How often each kind is asked while a page is open: local processes are
// cheap, a cluster is asked over the network.
export const INTERVALS: Record<Integration["kind"], number> = {
  local: 5_000,
  cluster: 30_000,
  jenkins: 60_000,
};

export async function integrationState(integration: Integration): Promise<IntegrationState> {
  if (integration.kind === "local") return localState(integration);
  if (integration.kind === "cluster") return clusterState(integration);
  return { id: integration.id, state: "unknown", detail: `${integration.kind} integrations are not asked yet` };
}

export async function integrationStates(integrations: Integration[]): Promise<IntegrationState[]> {
  return Promise.all(integrations.map(integrationState));
}

// The Kubernetes clusters a discussion may show deployments of: the kubectl
// contexts TOPIC_OVERVIEW_KUBE_CONTEXTS lists, separated by commas, each
// named after its environment as `DEV=<context>`. A context listed without a
// name is known by its cluster's name, the last part of a GKE context, which
// is named gke_<project>_<location>_<cluster>.

import { StoreError } from "./store.ts";

// Each configured context, with the name of its environment.
export function kubeContexts(): Map<string, string> {
  const contexts = new Map<string, string>();
  for (const entry of (process.env.TOPIC_OVERVIEW_KUBE_CONTEXTS ?? "").split(",")) {
    const [first, second] = entry.split("=").map((part) => part.trim());
    const context = second ?? first;
    if (!context) continue;
    contexts.set(context, second ? first : (/^gke_[^_]+_[^_]+_(.+)$/.exec(context)?.[1] ?? context));
  }
  return contexts;
}

// A deployment is <context>/<namespace>/<deployment>, in a configured
// context, since only those are asked.
export function deploymentReference(reference: string): { context: string; namespace: string; name: string } {
  const parts = reference.split("/");
  if (parts.length !== 3 || parts.some((part) => !part.trim())) {
    throw new StoreError(`a deployment is <context>/<namespace>/<deployment>, not ${reference}`);
  }
  const [context, namespace, name] = parts;
  if (!kubeContexts().has(context)) throw new StoreError(`${context} is not a context TOPIC_OVERVIEW_KUBE_CONTEXTS lists`);
  return { context, namespace, name };
}

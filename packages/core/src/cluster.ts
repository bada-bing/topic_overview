// The Kubernetes clusters a discussion may show deployments of: the kubectl
// contexts TOPIC_OVERVIEW_KUBE_CONTEXTS lists, separated by commas.

import { StoreError } from "./store.ts";

export function kubeContexts(): Set<string> {
  return new Set(
    (process.env.TOPIC_OVERVIEW_KUBE_CONTEXTS ?? "")
      .split(",")
      .map((context) => context.trim())
      .filter(Boolean),
  );
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

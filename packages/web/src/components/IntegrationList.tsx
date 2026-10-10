import { For, Show } from "solid-js";

import type { Integration } from "@topic-overview/core";

export interface IntegrationState {
  id: string;
  state: string;
  detail?: string;
}

// What the discussion depends on outside its source, with the state each
// system reports, kept current while the page is open.
export function IntegrationList(props: { integrations: Integration[]; states: Map<string, IntegrationState> }) {
  return (
    <Show when={props.integrations.length > 0}>
      <section class="integration-list">
        <h3>Integrations ({props.integrations.length})</h3>
        <For each={props.integrations}>
          {(integration) => {
            const state = () => props.states.get(integration.id);
            return (
              <div class="integration-entry" title={state()?.detail ?? integration.reference}>
                <span class="attachment-kind">{integration.kind}</span>
                <span class="integration-name">
                  {integration.label ?? integration.reference}
                  <Show when={state()?.detail}>
                    <span class="integration-detail">{state()?.detail}</span>
                  </Show>
                </span>
                <span class={["integration-state", `integration-${(state()?.state ?? "unknown").replace(/\s+/g, "-")}`]}>
                  {state()?.state ?? "…"}
                </span>
              </div>
            );
          }}
        </For>
      </section>
    </Show>
  );
}

import { For, Show, createSignal } from "solid-js";

import type { Integration } from "@topic-overview/core";

export interface IntegrationState {
  id: string;
  state: string;
  detail?: string;
  url?: string;
}

// Each kind as the panel names it, short, since the name follows.
const KINDS: Record<Integration["kind"], string> = {
  "merge-request": "MR",
  local: "process",
  cluster: "cluster",
  jenkins: "Jenkins",
};

// Whether the panel was left open, kept per browser; a page that cannot keep
// it opens with the panel closed.
const OPEN = "topic-overview:integrations-open";

// The icon of the system an integration lives on, such as a GitLab host's,
// read from the origin of what it links to, so no system is named here. The
// server fetches it once and keeps it, so it shows when the system cannot be
// reached.
function iconOf(link: string | undefined): string | undefined {
  if (!link || !/^https?:\/\//.test(link)) return undefined;
  return `/api/icon?origin=${encodeURIComponent(new URL(link).origin)}`;
}

function wasOpen(): boolean {
  try {
    return localStorage.getItem(OPEN) === "yes";
  } catch {
    return false;
  }
}

function keepOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN, open ? "yes" : "no");
  } catch {
    // The panel opens closed next time.
  }
}

// What the discussion depends on outside its source, in a panel opened from
// the bottom of the page when I want it, as wide as the page: the merge
// requests the page lists under Links, then what the agent added, each with
// the state its system reports, kept current while the page is open. What
// the page says of one is its description, until the system says more.
export function IntegrationPanel(props: { integrations: Integration[]; states: Map<string, IntegrationState> }) {
  const [open, setOpen] = createSignal(wasOpen());
  const toggle = () => {
    const next = !open();
    setOpen(next);
    keepOpen(next);
  };
  return (
    <Show when={props.integrations.length > 0}>
      <button type="button" class={["integration-tab", { open: open() }]} onClick={toggle} aria-expanded={open() ? "true" : "false"}>
        Integrations ({props.integrations.length}) {open() ? "▾" : "▴"}
      </button>
      <Show when={open()}>
        <section class="integration-panel">
          <table>
            <tbody>
              <For each={props.integrations}>
                {(integration) => {
                  const state = () => props.states.get(integration.id);
                  const name = integration.label ?? integration.reference;
                  // The kind is shown in words until the icon has loaded, and
                  // stays in words when it cannot.
                  const [iconShown, setIconShown] = createSignal(false);
                  const icon = () => iconOf(state()?.url ?? integration.reference);
                  return (
                    <tr title={integration.reference}>
                      <td class="integration-kind" title={KINDS[integration.kind]}>
                        <Show when={icon()}>
                          {(src) => (
                            <img
                              class={["integration-icon", { shown: iconShown() }]}
                              src={src()}
                              alt=""
                              onLoad={() => setIconShown(true)}
                              onError={() => setIconShown(false)}
                            />
                          )}
                        </Show>
                        <Show when={!iconShown()}>{KINDS[integration.kind]}</Show>
                      </td>
                      <td class="integration-name">
                        <Show when={state()?.url} fallback={name}>
                          {(url) => (
                            <a href={url()} target="_blank" rel="noreferrer">
                              {name}
                            </a>
                          )}
                        </Show>
                      </td>
                      <td class={["integration-state", `integration-${(state()?.state ?? "unknown").replace(/\s+/g, "-")}`]}>
                        {state()?.state ?? "…"}
                      </td>
                      <td class="integration-detail">{state()?.detail ?? integration.detail ?? ""}</td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </section>
      </Show>
    </Show>
  );
}

import { For, Show, createMemo, createSignal } from "solid-js";

import type { Integration } from "@topic-overview/core";

export interface IntegrationState {
  id: string;
  state: string;
  detail?: string;
  url?: string;
  environment?: string; // where it runs, such as DEV for a deployment
}

// The kinds in the order their groups stand in the panel, each named as its
// group's heading.
const KINDS: [Integration["kind"], string][] = [
  ["merge-request", "Merge requests"],
  ["local", "Processes"],
  ["cluster", "Deployments"],
  ["jenkins", "Builds"],
];

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

// What the page can do with a local process: bring its window up, and start
// or restart it, which is refused with a reason while the agent works.
export interface ProcessControl {
  focus: (id: string) => void;
  start: (id: string) => Promise<void>;
  blocked: () => string | undefined;
}

// What the discussion depends on outside its source, in a panel opened from
// the bottom of the page when I want it, as wide as the page: the merge
// requests the page lists under Links, then what the agent added, each with
// the state its system reports, kept current while the page is open. Each
// kind is a group of its own, side by side, since each shows something else:
// what the page says of a merge request is its description, until the system
// says more. A local process's name brings its window up, where its output
// is, and a button starts it, or restarts it while it runs.
export function IntegrationPanel(props: { integrations: Integration[]; states: Map<string, IntegrationState>; processes?: ProcessControl }) {
  const [open, setOpen] = createSignal(wasOpen());
  const toggle = () => {
    const next = !open();
    setOpen(next);
    keepOpen(next);
  };
  const groups = createMemo(() =>
    KINDS.map(([kind, heading]) => ({ kind, heading, integrations: props.integrations.filter((integration) => integration.kind === kind) })).filter(
      (group) => group.integrations.length > 0,
    ),
  );
  return (
    <Show when={props.integrations.length > 0}>
      <button type="button" class={["integration-tab", { open: open() }]} onClick={toggle} aria-expanded={open() ? "true" : "false"}>
        Integrations ({props.integrations.length}) {open() ? "▾" : "▴"}
      </button>
      <Show when={open()}>
        <section class="integration-panel">
          <For each={groups()} keyed={(group) => group.kind}>
            {(group) => (
              <IntegrationGroup
                heading={group().heading}
                integrations={group().integrations}
                states={props.states}
                processes={group().kind === "local" ? props.processes : undefined}
              />
            )}
          </For>
        </section>
      </Show>
    </Show>
  );
}

// One kind's integrations under a heading carrying the icon of the system
// they live on, when it has one that loads.
function IntegrationGroup(props: {
  heading: string;
  integrations: Integration[];
  states: Map<string, IntegrationState>;
  processes?: ProcessControl;
}) {
  const [iconShown, setIconShown] = createSignal(false);
  const icon = () => {
    const first = props.integrations[0];
    return iconOf(props.states.get(first.id)?.url ?? first.reference);
  };
  return (
    <div class="integration-group">
      <h3 class="integration-heading">
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
        {props.heading}
      </h3>
      <table>
        <tbody>
          <For each={props.integrations} keyed={(integration) => integration.id}>
            {(integration) => {
              const state = () => props.states.get(integration().id);
              const name = () => integration().label ?? integration().reference;
              return (
                <tr title={integration().reference}>
                  <td class="integration-name">
                    <Show
                      when={props.processes}
                      fallback={
                        <Show when={state()?.url} fallback={name()}>
                          {(url) => (
                            <a href={url()} target="_blank" rel="noreferrer">
                              {name()}
                            </a>
                          )}
                        </Show>
                      }
                    >
                      {(processes) => (
                        <button type="button" class="integration-window" title="Bring its window up" onClick={() => processes().focus(integration().id)}>
                          {name()}
                        </button>
                      )}
                    </Show>
                  </td>
                  <Show when={state()?.environment}>
                    {(environment) => (
                      <td class="integration-environment">
                        <span>{environment()}</span>
                      </td>
                    )}
                  </Show>
                  <td class={["integration-state", `integration-${(state()?.state ?? "unknown").replace(/\s+/g, "-")}`]}>
                    {state()?.state ?? "…"}
                  </td>
                  <Show when={props.processes}>
                    {(processes) => (
                      <td class="integration-action">
                        <StartButton running={state()?.state === "running"} control={processes()} id={integration().id} />
                      </td>
                    )}
                  </Show>
                  <td class="integration-detail">{state()?.detail ?? integration().detail ?? ""}</td>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
    </div>
  );
}

// Starts a process, or restarts it while it runs. What proc said when it
// failed shows on the button's title until the next try.
function StartButton(props: { running: boolean; control: ProcessControl; id: string }) {
  const [pending, setPending] = createSignal(false);
  const [failure, setFailure] = createSignal<string | undefined>(undefined);
  const start = () => {
    setPending(true);
    setFailure(undefined);
    props.control
      .start(props.id)
      .catch((error: Error) => setFailure(error.message))
      .finally(() => setPending(false));
  };
  return (
    <button
      type="button"
      class={["integration-start", { failed: failure() !== undefined }]}
      disabled={pending() || props.control.blocked() !== undefined}
      title={failure() ?? props.control.blocked() ?? (props.running ? "Restart it" : "Start it")}
      onClick={start}
    >
      {pending() ? "…" : props.running ? "Restart" : "Start"}
    </button>
  );
}

import { For, Show, createMemo, createSignal } from "solid-js";

import type { Integration } from "@topic-overview/core";

export interface IntegrationState {
  id: string;
  state: string;
  detail?: string;
  url?: string;
  environment?: string; // where it runs, such as DEV for a deployment
  name?: string; // what the system calls it, such as a page's title
}

// The kinds as the panel shows them: two columns, each answering one
// question. The left one is the change's way through review and CI, the
// right one where it runs, locally, in a browser or in a cluster. Each kind
// is a group under its heading.
const COLUMNS: [Integration["kind"], string][][] = [
  [
    ["merge-request", "Merge requests"],
    ["jenkins", "Builds"],
  ],
  [
    ["local", "Processes"],
    ["browser", "Pages"],
    ["cluster", "Deployments"],
  ],
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

// What the page can do with what runs: bring a local process's window or a
// page's tab up, start or restart a process, which is refused with a reason
// while the agent works, and open a page's tab again.
export interface IntegrationControl {
  focus: (id: string) => Promise<void>;
  start: (id: string) => Promise<void>;
  open: (id: string) => Promise<void>;
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
export function IntegrationPanel(props: { integrations: Integration[]; states: Map<string, IntegrationState>; control?: IntegrationControl }) {
  const [open, setOpen] = createSignal(wasOpen());
  const toggle = () => {
    const next = !open();
    setOpen(next);
    keepOpen(next);
  };
  // The columns with something in them, so one alone takes the whole width.
  const columns = createMemo(() =>
    COLUMNS.map((column) =>
      column
        .map(([kind, heading]) => ({ kind, heading, integrations: props.integrations.filter((integration) => integration.kind === kind) }))
        .filter((group) => group.integrations.length > 0),
    ).filter((column) => column.length > 0),
  );
  return (
    <Show when={props.integrations.length > 0}>
      <div class="integrations">
        <button type="button" class="integration-tab" onClick={toggle} aria-expanded={open() ? "true" : "false"}>
          Integrations ({props.integrations.length}) {open() ? "▾" : "▴"}
        </button>
        <Show when={open()}>
          <section class="integration-panel">
            <For each={columns()} keyed={false}>
              {(column) => (
                <div class="integration-column">
                  <For each={column()} keyed={(group) => group.kind}>
                    {(group) => (
                      <IntegrationGroup
                        heading={group().heading}
                        integrations={group().integrations}
                        states={props.states}
                        kind={group().kind}
                        control={group().kind === "local" || group().kind === "browser" ? props.control : undefined}
                      />
                    )}
                  </For>
                </div>
              )}
            </For>
          </section>
        </Show>
      </div>
    </Show>
  );
}

// One kind's integrations under a heading carrying an icon, when it has one
// that loads.
function IntegrationGroup(props: {
  heading: string;
  integrations: Integration[];
  states: Map<string, IntegrationState>;
  kind: Integration["kind"];
  control?: IntegrationControl;
}) {
  const [iconShown, setIconShown] = createSignal(false);
  // A local process's icon is the terminal app's, where its window is
  // brought up, and a page's the browser's, where its tab is; the others
  // are the icon of the system they link to.
  const icon = () => {
    const first = props.integrations[0];
    if (first.kind === "local") return "/api/icon?app=terminal";
    if (first.kind === "browser") return "/api/icon?app=browser";
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
              const name = () => integration().label ?? state()?.name ?? integration().reference;
              // Why bringing it up failed, until it next works.
              const [failure, setFailure] = createSignal<string | undefined>(undefined);
              const focus = (control: IntegrationControl) =>
                control.focus(integration().id).then(
                  () => setFailure(undefined),
                  (error: Error) => setFailure(error.message),
                );
              const closed = () => ["not open", "not running"].includes(state()?.state ?? "");
              return (
                <tr title={integration().reference}>
                  <td class="integration-name">
                    <Show
                      when={props.control}
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
                      {(control) => (
                        <button type="button" class="integration-window" title="Bring it up" onClick={() => void focus(control())}>
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
                  <Show when={props.control}>
                    {(control) => (
                      <td class="integration-action">
                        <Show when={props.kind === "local"}>
                          <ActionButton
                            label={state()?.state === "running" ? "Restart" : "Start"}
                            run={() => control().start(integration().id)}
                            blocked={control().blocked}
                          />
                        </Show>
                        <Show when={props.kind === "browser" && closed()}>
                          <ActionButton label="Open" run={() => control().open(integration().id).then(() => setFailure(undefined))} />
                        </Show>
                      </td>
                    )}
                  </Show>
                  <td class={["integration-detail", { failed: failure() !== undefined }]}>{failure() ?? state()?.detail ?? integration().detail ?? ""}</td>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
    </div>
  );
}

// A button that does something to an integration, such as starting a
// process or opening a page. What failed shows on its title until the next
// try.
function ActionButton(props: { label: string; run: () => Promise<void>; blocked?: () => string | undefined }) {
  const [pending, setPending] = createSignal(false);
  const [failure, setFailure] = createSignal<string | undefined>(undefined);
  const run = () => {
    setPending(true);
    setFailure(undefined);
    props
      .run()
      .catch((error: Error) => setFailure(error.message))
      .finally(() => setPending(false));
  };
  return (
    <button
      type="button"
      class={["integration-start", { failed: failure() !== undefined }]}
      disabled={pending() || props.blocked?.() !== undefined}
      title={failure() ?? props.blocked?.() ?? props.label}
      onClick={run}
    >
      {pending() ? "…" : props.label}
    </button>
  );
}

import type { JSX } from "@solidjs/web";
import { For, Show, createSignal } from "solid-js";

// A panel the dock can open: what its tab reads, and its content, made when
// it is opened.
export interface DockPanel {
  id: string;
  label: string;
  content: () => JSX.Element;
}

// Which panel was left open, kept per browser; a page that cannot keep it
// opens with the dock closed.
const OPEN = "topic-overview:dock";

function wasOpen(): string | undefined {
  try {
    return localStorage.getItem(OPEN) ?? undefined;
  } catch {
    return undefined;
  }
}

function keepOpen(id: string | undefined): void {
  try {
    if (id) localStorage.setItem(OPEN, id);
    else localStorage.removeItem(OPEN);
  } catch {
    // The dock opens closed next time.
  }
}

// The panels opened from the bottom of the page when I want them, as wide
// as the page, one at a time: a tab for each, and the open one above the
// tabs. Choosing the open one's tab closes it.
export function Dock(props: { panels: DockPanel[] }) {
  const [open, setOpen] = createSignal(wasOpen());
  const shown = () => props.panels.find((panel) => panel.id === open());
  const toggle = (id: string) => {
    const next = open() === id ? undefined : id;
    setOpen(next);
    keepOpen(next);
  };
  return (
    <Show when={props.panels.length > 0}>
      <div class="dock">
        <div class="dock-tabs">
          <For each={props.panels} keyed={(panel) => panel.id}>
            {(panel) => (
              <button
                type="button"
                class={["dock-tab", { open: open() === panel().id }]}
                onClick={() => toggle(panel().id)}
                aria-expanded={open() === panel().id ? "true" : "false"}
              >
                {panel().label} {open() === panel().id ? "▾" : "▴"}
              </button>
            )}
          </For>
        </div>
        <Show when={shown()} keyed>
          {(panel) => panel.content()}
        </Show>
      </div>
    </Show>
  );
}

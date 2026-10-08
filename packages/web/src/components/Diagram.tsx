import { Show, createEffect, createSignal } from "solid-js";

// The notations a diagram can be written in, each rendered by its own
// library. Both are loaded only when a page shows a diagram of their kind.
export const DIAGRAM_LANGUAGES = new Set(["mermaid", "bpmn"]);

let mermaidCount = 0;

async function renderMermaid(container: HTMLElement, source: string): Promise<void> {
  const { default: mermaid } = await import("mermaid");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "strict",
    suppressErrorRendering: true,
  });
  // Parsing first throws on a broken diagram before Mermaid draws anything,
  // so its own error graphic never lands on the page.
  await mermaid.parse(source);
  mermaidCount += 1;
  const { svg } = await mermaid.render(`mermaid-${mermaidCount}`, source);
  container.innerHTML = svg;
}

async function renderBpmn(container: HTMLElement, source: string): Promise<void> {
  const { default: Viewer } = await import("bpmn-js/lib/NavigatedViewer");
  const viewer = new Viewer({ container });
  await viewer.importXML(source);
  (viewer.get("canvas") as { zoom: (level: string) => void }).zoom("fit-viewport");
}

// A diagram kept as its source and rendered on the page. When it cannot be
// rendered, the page shows the error and the source instead.
export function Diagram(props: { language: string; source: string }) {
  const [error, setError] = createSignal<string | undefined>(undefined);
  let container: HTMLDivElement | undefined;

  // The source may still be loading, as an attachment's is; the effect waits
  // for it, then draws into the container.
  createEffect(
    () => ({ language: props.language, source: props.source }),
    ({ language, source }) => {
      const target = container;
      if (!target) return;
      const render = language === "bpmn" ? renderBpmn : renderMermaid;
      render(target, source).catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : String(failure));
      });
    },
  );

  return (
    <Show
      when={!error()}
      fallback={
        <div class="diagram-error">
          <div class="error">The {props.language} diagram could not be rendered: {error()}</div>
          <pre class="codeblock">
            <code>{props.source}</code>
          </pre>
        </div>
      }
    >
      <div class={["diagram", `diagram-${props.language}`]} ref={(element) => (container = element)} />
    </Show>
  );
}

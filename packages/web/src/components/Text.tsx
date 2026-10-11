import { For, Show, createSignal, useContext } from "solid-js";

import { MENTION } from "@topic-overview/core/page";

import { OpenPageContext } from "../column.ts";
import { MERGE_REQUEST, MergeRequestLink } from "./MergeRequestLink.tsx";
import { DIAGRAM_LANGUAGES, assetsIn } from "../asset.ts";
import { AssetChip } from "./AssetChip.tsx";
import { AssetView } from "./AssetView.tsx";
import { type Inline, parseText } from "../inline.ts";
import { type PagePreview, loadPreview } from "../previews.ts";
import { useRelate } from "../relate.ts";

// A block's text with its inline markdown and fenced code blocks rendered.
export function Text(props: { text: string }) {
  return (
    <For each={parseText(props.text)}>
      {(part) =>
        part.kind === "table" ? (
          <AssetChip asset={{ kind: "table", table: part.table }} />
        ) : part.kind === "codeblock" ? (
          DIAGRAM_LANGUAGES.has(part.language) ? (
            <AssetChip asset={{ kind: "diagram", language: part.language, source: part.code }} />
          ) : (
            <pre class="codeblock">
              <code>{part.code}</code>
            </pre>
          )
        ) : (
          <span class="inline-text">
            <For each={part.inlines}>{(inline) => <InlinePiece inline={inline} />}</For>
          </span>
        )
      }
    </For>
  );
}

function InlinePiece(props: { inline: Inline }) {
  const inline = props.inline;
  switch (inline.kind) {
    case "bold":
      return <strong>{inline.text}</strong>;
    case "italic":
      return <em>{inline.text}</em>;
    case "code":
      return <code>{inline.text}</code>;
    case "link":
      if (MERGE_REQUEST.test(inline.href)) return <MergeRequestLink href={inline.href} text={inline.text} />;
      return (
        <a href={inline.href} target="_blank" rel="noreferrer">
          {inline.text}
        </a>
      );
    case "image":
      return <AssetChip asset={{ kind: "image", alt: inline.alt, src: inline.src }} />;
    case "page":
      return <PageLink name={inline.name} />;
    case "reference":
      return <BlockLink target={inline.id} label={inline.id} kind="reference" />;
    default:
      return <Mentions text={inline.text} />;
  }
}

// Plain text, with a mention of a label on the page made a link to the
// block that carries it.
function Mentions(props: { text: string }) {
  const relate = useRelate();
  const pieces = () => {
    const out: { text: string; target?: string }[] = [];
    let last = 0;
    for (const match of props.text.matchAll(MENTION)) {
      const target = relate.labels().get(match[1]);
      // A block's own label, as R2 in "R2: …", names it rather than relates.
      const ownLabel = match.index === 0 && props.text[match[0].length] === ":";
      if (!target || ownLabel) continue;
      if (match.index > last) out.push({ text: props.text.slice(last, match.index) });
      out.push({ text: match[1], target });
      last = match.index + match[0].length;
    }
    if (last < props.text.length) out.push({ text: props.text.slice(last) });
    return out;
  };
  return (
    <For each={pieces()}>
      {(piece) =>
        piece.target ? (
          <BlockLink target={piece.target} label={piece.text} kind="mention" />
        ) : (
          <>{piece.text}</>
        )
      }
    </For>
  );
}

const PREVIEW_LENGTH = 240;

// A link to a block on the page. Hovering it shows the block's text, which
// is already in the browser.
function BlockLink(props: { target: string; label: string; kind: "reference" | "mention" }) {
  const relate = useRelate();
  const text = () => {
    const full = relate.blockText(props.target) ?? "";
    return full.length > PREVIEW_LENGTH ? `${full.slice(0, PREVIEW_LENGTH)}…` : full;
  };
  // A block that holds an asset is previewed as the asset, at a fixed size.
  const asset = () => assetsIn(relate.blockText(props.target) ?? "")[0];
  const [hovered, setHovered] = createSignal(false);
  return (
    <a
      class={[props.kind, "has-preview", { missing: relate.blockText(props.target) === undefined }]}
      href={`#${props.target}`}
      onPointerEnter={() => setHovered(true)}
    >
      {props.label}
      <Show
        when={asset()}
        fallback={
          <Show when={text()}>
            <span class="preview">{text()}</span>
          </Show>
        }
      >
        {(shown) => (
          <Show when={hovered()}>
            <span class="preview asset-preview">
              <AssetView asset={shown()} />
            </span>
          </Show>
        )}
      </Show>
    </a>
  );
}

// A link to another page in the knowledge base. Hovering it fetches a short
// preview, once; clicking it opens the page in the column beside.
function PageLink(props: { name: string }) {
  const openPage = useContext(OpenPageContext);
  const [preview, setPreview] = createSignal<PagePreview | undefined>(undefined);
  const [missing, setMissing] = createSignal(false);
  const load = () => {
    if (preview() || missing()) return;
    loadPreview(props.name).then(setPreview, () => setMissing(true));
  };
  return (
    <span
      class={["page-link", "has-preview", { missing: missing() }]}
      role="link"
      tabindex="0"
      onPointerEnter={load}
      onClick={() => openPage(props.name)}
    >
      {props.name}
      <Show when={preview()}>
        {(shown) => (
          <span class="preview">
            <For each={Object.entries(shown().properties)}>
              {([key, value]) => (
                <span class="preview-property">
                  {key}: {value}
                </span>
              )}
            </For>
            <For each={shown().lines}>{(line) => <span class="preview-line">{line}</span>}</For>
          </span>
        )}
      </Show>
    </span>
  );
}

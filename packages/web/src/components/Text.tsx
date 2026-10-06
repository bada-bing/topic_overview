import { For } from "solid-js";

import { MENTION } from "@topic-overview/core/page";

import { type Inline, parseText } from "../inline.ts";
import { useRelate } from "../relate.ts";

// A block's text with its inline markdown and fenced code blocks rendered.
export function Text(props: { text: string }) {
  return (
    <For each={parseText(props.text)}>
      {(part) =>
        part.kind === "codeblock" ? (
          <pre class="codeblock">
            <code>{part.code}</code>
          </pre>
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
      return (
        <a href={inline.href} target="_blank" rel="noreferrer">
          {inline.text}
        </a>
      );
    case "page":
      return <span class="page-link">{inline.name}</span>;
    case "reference":
      return (
        <a class="reference" href={`#${inline.id}`}>
          {inline.id}
        </a>
      );
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
          <a class="mention" href={`#${piece.target}`}>
            {piece.text}
          </a>
        ) : (
          <>{piece.text}</>
        )
      }
    </For>
  );
}

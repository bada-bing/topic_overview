import { For } from "solid-js";

import { type Inline, parseText } from "../inline.ts";

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
      return <>{inline.text}</>;
  }
}

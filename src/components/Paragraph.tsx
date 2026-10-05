import type { Block } from "../types.ts";

// A regular block: its text, with the line breaks it was written with.
export function Paragraph(props: { block: Block }) {
  return (
    <p id={props.block.id} class="paragraph">
      {props.block.text}
    </p>
  );
}

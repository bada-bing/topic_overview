// A markdown table: a header row, a separator row, and the rows under it.
// Cells are split on unescaped pipes and trimmed.

export interface Table {
  header: string[];
  rows: string[][];
}

const SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

function cells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replaceAll("\\|", "|"));
}

export function parseTable(text: string): Table | undefined {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || !SEPARATOR.test(lines[1])) return undefined;
  return { header: cells(lines[0]), rows: lines.slice(2).map(cells) };
}

// A run of text with the tables in it taken out: consecutive lines that start
// with a pipe and read as a table. Lines that only look like one stay text.
export type Run = { kind: "text"; text: string } | { kind: "table"; table: Table };

export function splitTables(text: string): Run[] {
  const runs: Run[] = [];
  const lines = text.split("\n");
  let plain: string[] = [];
  const flush = () => {
    if (plain.length) runs.push({ kind: "text", text: plain.join("\n") });
    plain = [];
  };
  for (let index = 0; index < lines.length; ) {
    let end = index;
    while (end < lines.length && lines[end].trim().startsWith("|")) end += 1;
    const table = end > index ? parseTable(lines.slice(index, end).join("\n")) : undefined;
    if (table) {
      flush();
      runs.push({ kind: "table", table });
      index = end;
    } else {
      plain.push(lines[index]);
      index += 1;
    }
  }
  flush();
  return runs;
}

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

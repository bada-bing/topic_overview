// What a Claude Code session says and does, read from its transcript: the
// JSONL file Claude Code appends under ~/.claude/projects, one entry per
// line, written as each content block completes. Only the shapes known here
// are read: what I typed, what the agent replied, and each tool it called
// with what came back. Everything else, and whatever a new version adds, is
// skipped rather than shown wrong, since the format is Claude Code's own and
// undocumented.

export type TranscriptEntry =
  | { kind: "prompt"; id: string; at: string; text: string } // what I typed
  | { kind: "reply"; id: string; at: string; text: string } // what the agent said, as markdown
  | { kind: "tool"; id: string; at: string; name: string; summary: string; input: string; result?: string; failed?: boolean }
  | { kind: "result"; id: string; tool: string; at: string; text: string; failed: boolean }; // what a tool returned, until it is merged into the call

// How much of a tool's input or result is kept: enough to read, never a
// whole file.
const CLIP = 4_000;
// The field of a tool's input that says what the call is about, the first
// one present; a tool with none of them is summarised by its first text.
const SUMMARY_FIELDS = ["description", "file_path", "command", "pattern", "skill", "query", "url", "prompt"];

interface Line {
  type?: string;
  uuid?: string;
  timestamp?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  message?: { role?: string; content?: unknown };
}

interface ContentBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

// The entries one line of the transcript holds: none for a line of a shape
// not known here, or one that is not part of the conversation, such as a
// subagent's or what a skill loaded.
export function parseTranscriptLine(line: string): TranscriptEntry[] {
  let parsed: Line;
  try {
    parsed = JSON.parse(line) as Line;
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null || parsed.isSidechain || parsed.isMeta) return [];
  const at = parsed.timestamp ?? "";
  const id = parsed.uuid ?? "";
  const content = parsed.message?.content;
  if (parsed.type === "user") {
    if (typeof content === "string") {
      const text = promptText(content);
      return text ? [{ kind: "prompt", id, at, text }] : [];
    }
    if (!Array.isArray(content)) return [];
    const blocks = content as ContentBlock[];
    const results = blocks.filter((block) => block.type === "tool_result" && typeof block.tool_use_id === "string");
    if (results.length > 0) {
      return results.map((block, index) => ({
        kind: "result",
        id: `${id}:${index}`,
        tool: block.tool_use_id!,
        at,
        text: clip(resultText(block.content)),
        failed: block.is_error === true,
      }));
    }
    const text = promptText(blocks.flatMap((block) => (block.type === "text" && typeof block.text === "string" ? [block.text] : [])).join("\n"));
    return text ? [{ kind: "prompt", id, at, text }] : [];
  }
  if (parsed.type === "assistant" && Array.isArray(content)) {
    const blocks = content as ContentBlock[];
    return blocks.flatMap((block, index): TranscriptEntry[] => {
      if (block.type === "text" && typeof block.text === "string" && block.text.trim() !== "") {
        return [{ kind: "reply", id: blocks.length > 1 ? `${id}:${index}` : id, at, text: block.text }];
      }
      if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
        return [{ kind: "tool", id: block.id, at, name: block.name, summary: summarise(block.input), input: clip(inputText(block.input)) }];
      }
      return [];
    });
  }
  return [];
}

// Every entry of a transcript, with each tool's result merged into its call.
export function parseTranscript(text: string): TranscriptEntry[] {
  return mergeTranscript([], text.split("\n").flatMap(parseTranscriptLine));
}

// New entries added to those known: a result goes into the call it answers,
// and an entry already known, as when a file is read again, is not added
// twice.
export function mergeTranscript(known: TranscriptEntry[], added: TranscriptEntry[]): TranscriptEntry[] {
  const merged = [...known];
  const ids = new Set(merged.map((entry) => entry.id));
  for (const entry of added) {
    if (entry.kind === "result") {
      const index = merged.findIndex((call) => call.kind === "tool" && call.id === entry.tool);
      if (index === -1) continue;
      const call = merged[index];
      if (call.kind === "tool") merged[index] = { ...call, result: entry.text, failed: entry.failed };
      continue;
    }
    if (ids.has(entry.id)) continue;
    ids.add(entry.id);
    merged.push(entry);
  }
  return merged;
}

// What I typed, without what the harness wrapped around it: the reminders
// it adds are not mine, and pasted text is shown as the text, not its tags.
function promptText(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<\/?pasted_content(?:\s[^>]*)?>/g, "")
    .trim();
}

function summarise(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const fields = input as Record<string, unknown>;
  for (const field of SUMMARY_FIELDS) {
    if (typeof fields[field] === "string" && fields[field].trim() !== "") return firstLine(fields[field]);
  }
  const text = Object.values(fields).find((value): value is string => typeof value === "string" && value.trim() !== "");
  return text ? firstLine(text) : "";
}

function firstLine(text: string): string {
  const line = text.trim().split("\n")[0];
  return line.length > 160 ? `${line.slice(0, 159)}…` : line;
}

function inputText(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const fields = input as Record<string, unknown>;
  // One text field alone reads better as the text than as JSON.
  const values = Object.values(fields);
  if (values.length === 1 && typeof values[0] === "string") return values[0];
  return JSON.stringify(fields, null, 2);
}

// A tool's result is text, or blocks of text, as the API gives it.
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as ContentBlock[])
    .flatMap((block) => (block.type === "text" && typeof block.text === "string" ? [block.text] : []))
    .join("\n");
}

function clip(text: string): string {
  return text.length > CLIP ? `${text.slice(0, CLIP)}\n… ${text.length - CLIP} more characters` : text;
}

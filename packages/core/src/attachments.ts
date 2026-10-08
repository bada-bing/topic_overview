// Attachments: a diagram, a table or an image that belongs to a discussion
// but need not come from its source. Each is a file in `attachments/`, and
// `attachments/index.json` records where every one came from.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const ATTACHMENT_KINDS = ["mermaid", "bpmn", "table", "image"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export interface Attachment {
  id: string;
  file: string; // a name inside attachments/, never a path
  kind: AttachmentKind;
  title: string;
  author: string; // who wrote it
  blocks: string[]; // the blocks it is about
  time: string; // when it was written
}

const FILE = /^[\w][\w.-]*$/;

export async function readAttachments(dir: string): Promise<Attachment[]> {
  try {
    return JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as Attachment[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

// Every problem with a set of attachments, checked against the page they
// belong to: each has an id of its own, a known kind, a file that exists,
// and blocks that are on the page.
export async function validateAttachments(dir: string, attachments: Attachment[], blockIds: Set<string>): Promise<string[]> {
  const problems: string[] = [];
  const files = new Set(await readdir(dir));
  const ids = new Set<string>();
  for (const attachment of attachments) {
    const name = attachment.id || "(no id)";
    if (!attachment.id) problems.push("an attachment has no id");
    else if (ids.has(attachment.id)) problems.push(`the attachment id ${attachment.id} is used more than once`);
    ids.add(attachment.id);
    if (!ATTACHMENT_KINDS.includes(attachment.kind)) problems.push(`${name} has an unknown kind: ${attachment.kind}`);
    if (!attachment.file || !FILE.test(attachment.file)) problems.push(`${name} names no valid file: ${attachment.file}`);
    else if (!files.has(attachment.file)) problems.push(`${name} names ${attachment.file}, which is not in attachments/`);
    if (!attachment.title) problems.push(`${name} has no title`);
    if (!attachment.author) problems.push(`${name} does not say who wrote it`);
    for (const block of attachment.blocks ?? []) {
      if (!blockIds.has(block)) problems.push(`${name} is about ${block}, which is not on the page`);
    }
  }
  return problems;
}

export function isAttachmentFile(name: string): boolean {
  return FILE.test(name);
}

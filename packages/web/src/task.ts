// What a task page's header shows: where the task stands. A page is a task
// page when its frontmatter carries a task_title.

import type { Block, Page } from "@topic-overview/core/page";

export interface TaskHeader {
  key: string;
  title: string;
  status: string;
  phase: string;
  steps: Link[]; // the NOW step of Task Progress
  actions: Link[]; // the NOW items of the Action Plan
}

export interface Link {
  id: string;
  text: string;
}

const NOW = /^NOW (.*)$/s;

export function frontmatter(page: Page): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of page.frontmatter.split("\n")) {
    const match = /^([\w-]+):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = match[2].trim();
  }
  return fields;
}

export function taskHeader(page: Page): TaskHeader | undefined {
  const fields = frontmatter(page);
  if (!fields.task_title) return undefined;

  const title = page.blocks[0];
  const key = title?.kind === "heading" ? title.text.split(" ")[0] : "";
  const progress = findHeading(page.blocks, "Task Progress");
  const plan = findHeading(page.blocks, "Action Plan");

  return {
    key,
    title: fields.task_title,
    status: fields.status ?? "",
    phase: fields.phase ?? "",
    steps: progress ? nowItems(progress.children.flatMap((phase) => phase.children)) : [],
    actions: plan ? nowItems(plan.children) : [],
  };
}

function findHeading(blocks: Block[], text: string): Block | undefined {
  for (const block of blocks) {
    if (block.kind === "heading" && block.text === text) return block;
    const found = findHeading(block.children, text);
    if (found) return found;
  }
  return undefined;
}

function nowItems(blocks: Block[]): Link[] {
  return blocks.flatMap((block) => {
    const match = NOW.exec(block.text);
    return match ? [{ id: block.id, text: match[1].split("\n")[0] }] : [];
  });
}

// A block the agent changed, marked on the page until I confirm I saw it. A
// mark is on its block's id, which the agent's commands need anyway; a
// removed block has none left, so its mark keeps what it read.
export interface Mark {
  id?: string; // the block's id; none for a removed block
  text?: string; // what a removed block read
  kind: "changed" | "new" | "moved" | "removed"; // a removed block is gone from the page, so it is only listed
  before?: string; // what the block read before the change, or where it was before a move
  next?: string; // for a removed block: the block that follows in its place
  parent?: string; // for a removed block that ended its parent's children: that parent
}

// What a mark is known by: its block's id, or what a removed block read.
export function markKey(mark: Mark): string {
  return mark.id ?? mark.text ?? "";
}

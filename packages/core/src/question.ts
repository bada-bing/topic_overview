// A question I ask the discussion's agent about a block, kept beside the
// block until I dismiss it. It belongs to the discussion and ends with it.
// It is an exchange: each follow-up is asked once the one before it is
// answered. The block is known by its id, which asking gives it; the text and
// the commit say what it read when I asked.
export interface Question {
  id: string;
  block: string; // the block's id
  text: string; // the block's own text when I asked
  commit: string; // the commit the discussion's branch was at when I asked
  exchanges: Exchange[]; // the first question, then each follow-up, in order
}

export interface Exchange {
  prompt: string;
  asked: string;
  answer?: string; // the agent's answer, once it has given one
  answered?: string;
}

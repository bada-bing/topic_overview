// A question I ask about the topic, kept until I dismiss it. It belongs to
// the discussion and ends with it. It is an exchange: each follow-up is
// asked once the one before it is answered.
//
// A question is about a block, or general, about the topic rather than one
// block; and it is answered by the main agent, or by a fork of the main
// session, chosen when it is asked. A block is known by its id, which
// asking gives it; the text and the commit say what it read when I asked. A
// fork has `session`, its own session id, given when the question is asked,
// and its follow-ups continue that fork. Dismissing the question ends the
// fork, its transcript included.
export interface Question {
  id: string;
  block?: string; // the block's id; none for a general question
  text?: string; // the block's own text when I asked
  commit: string; // the commit the discussion's branch was at when I asked
  session?: string; // the fork's session id, for a question a fork answers
  exchanges: Exchange[]; // the first question, then each follow-up, in order
}

export interface Exchange {
  prompt: string;
  asked: string;
  answer?: string; // the agent's answer, once it has given one
  answered?: string;
}

// A question a fork of the main session answers, rather than the main agent.
export function isFork(question: Question): boolean {
  return question.session !== undefined;
}

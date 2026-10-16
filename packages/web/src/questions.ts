import { createContext, useContext } from "solid-js";

import { type Question, isFork } from "@topic-overview/core/question";

// Asking the discussion's agent about a block, and the questions kept
// beside their blocks until I dismiss them. While the agent works, nothing is
// asked or dismissed, so one writer works at a time.
export interface Questions {
  available: boolean; // only in a discussion on the source itself
  of: (block: string) => Question[];
  ask: (block: string, prompt: string) => Promise<void>;
  askFork: (prompt: string, block?: string) => Promise<void>; // a question for a fork of the main session, about a block or general
  followUp: (question: Question, prompt: string) => Promise<void>; // asking further, once the last answer has come
  dismiss: (question: Question) => void;
  blocked: () => string | undefined; // why nothing can be asked now: the agent works, or is gone
  forkBlocked: () => string | undefined; // why no fork can be asked now: there is no session to fork
  working: () => boolean; // the agent works, so what is not answered yet is being answered
}

// Where a question stands, in words: its last answer has come, the agent is
// working on it, or it waits for the agent.
// A fork runs from the moment it is asked, so its question is being answered
// until the answer comes.
export function standing(question: Question, working: boolean): string {
  if (question.exchanges.at(-1)?.answer !== undefined) return "answered";
  return working || isFork(question) ? "being answered" : "waiting for the answer";
}

// Why a question cannot be followed up or dismissed now: a fork question
// never waits on the main agent, a block question does.
export function blockedFor(question: Question, questions: Questions): string | undefined {
  return isFork(question) ? undefined : questions.blocked();
}

export const QuestionsContext = createContext<Questions>({
  available: false,
  of: () => [],
  ask: async () => {},
  askFork: async () => {},
  followUp: async () => {},
  dismiss: () => {},
  blocked: () => undefined,
  forkBlocked: () => undefined,
  working: () => false,
});

export function useQuestions(): Questions {
  return useContext(QuestionsContext);
}

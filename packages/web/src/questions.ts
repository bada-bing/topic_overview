import { createContext, useContext } from "solid-js";

import type { Question } from "@topic-overview/core/question";

// Asking the discussion's agent about a block, and the questions kept
// beside their blocks until I dismiss them. While the agent works, nothing is
// asked or dismissed, so one writer works at a time.
export interface Questions {
  available: boolean; // only in a discussion on the source itself
  of: (block: string) => Question[];
  ask: (block: string, prompt: string) => Promise<void>;
  followUp: (question: Question, prompt: string) => Promise<void>; // asking further, once the last answer has come
  dismiss: (question: Question) => void;
  blocked: () => string | undefined; // why nothing can be asked now: the agent works, or is gone
}

export const QuestionsContext = createContext<Questions>({
  available: false,
  of: () => [],
  ask: async () => {},
  followUp: async () => {},
  dismiss: () => {},
  blocked: () => undefined,
});

export function useQuestions(): Questions {
  return useContext(QuestionsContext);
}

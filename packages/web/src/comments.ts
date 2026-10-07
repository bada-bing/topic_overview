import { createContext, useContext } from "solid-js";

import type { Annotation } from "@topic-overview/core";

// The comments of the open discussion, as the blocks see them. A closed
// discussion is read-only, and a linked page's blocks take no comments.
export interface Comments {
  readOnly: () => boolean;
  of: (block: string) => Annotation[];
  add: (block: string, body: string) => Promise<void>;
  edit: (id: string, body: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const CommentsContext = createContext<Comments>({
  readOnly: () => true,
  of: () => [],
  add: async () => {},
  edit: async () => {},
  remove: async () => {},
});

export function useComments(): Comments {
  return useContext(CommentsContext);
}

// Sends one change to the server and answers with the comments as they now
// are.
export async function changeComments(
  base: string,
  method: "POST" | "PATCH" | "DELETE",
  id: string | undefined,
  body?: unknown,
): Promise<Annotation[]> {
  const response = await fetch(id ? `${base}/comments/${encodeURIComponent(id)}` : `${base}/comments`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new Error(parsed?.error ?? `the server answered ${response.status}`);
  return parsed as Annotation[];
}

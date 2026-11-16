"use client";

import { createContext, useContext } from "react";
import type { Comment } from "@/lib/types";

type CommentsContextValue = {
  /** Every comment on the page, so a ">>123" mention can show a preview of the post it points to. */
  byId: ReadonlyMap<number, Comment>;
  /** The posts that answer each post, shown as backlinks. */
  backlinks: ReadonlyMap<number, number[]>;
  /** Opens the comment box with ">>id" written in it, as clicking a post number does on 4chan. */
  quote: (id: number) => void;
};

export const CommentsContext = createContext<CommentsContextValue>({
  byId: new Map(),
  backlinks: new Map(),
  quote: () => {},
});

export const useComments = () => useContext(CommentsContext);

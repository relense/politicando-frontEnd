import type { Comment } from "@/lib/types";

export type CommentNode = Comment & { replies: CommentNode[] };

/** Anonymous by default. The post number is shown separately, so "joao7" never reads as "joao712". */
export function displayName(comment: Pick<Comment, "username">): string {
  return comment.username || "anon";
}

/**
 * Builds the comment tree from the API's flat list without changing the input. Replies whose
 * parent is missing are shown at the top level so they are never lost.
 */
export function buildCommentTree(comments: readonly Comment[]): CommentNode[] {
  const nodes = new Map<number, CommentNode>(comments.map((comment) => [comment.id, { ...comment, replies: [] }]));

  const roots: CommentNode[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parentId === null || comment.parentId === comment.id ? undefined : nodes.get(comment.parentId);
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Replies at any depth, so a collapsed comment can show how much it hides. */
export function countReplies(node: CommentNode): number {
  return node.replies.reduce((total, reply) => total + 1 + countReplies(reply), 0);
}

/** A ">>123" mention, as on 4chan. */
const MENTION = />>(\d{1,10})/g;

export type TextPart = string | { mention: number };

/** Splits a comment into plain text and ">>123" mentions, in order. */
export function splitMentions(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ mention: Number(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** The posts each post mentions, without repeats or itself. */
export function mentionsOf(comment: Pick<Comment, "id" | "text">): number[] {
  const ids = new Set<number>();
  for (const part of splitMentions(comment.text)) {
    if (typeof part !== "string" && part.mention !== comment.id) ids.add(part.mention);
  }
  return [...ids];
}

/**
 * For each post, the posts that answer it: direct replies and posts that mention it, oldest first.
 * Shown as 4chan-style backlinks so a conversation can be followed across the thread.
 */
export function buildBacklinks(comments: readonly Comment[]): Map<number, number[]> {
  const backlinks = new Map<number, number[]>();
  const add = (target: number, from: number) => {
    const list = backlinks.get(target) ?? [];
    if (!list.includes(from)) list.push(from);
    backlinks.set(target, list);
  };
  for (const comment of comments) {
    if (comment.pending) continue;
    if (comment.parentId !== null && comment.parentId !== comment.id) add(comment.parentId, comment.id);
    for (const id of mentionsOf(comment)) add(id, comment.id);
  }
  for (const list of backlinks.values()) list.sort((a, b) => a - b);
  return backlinks;
}

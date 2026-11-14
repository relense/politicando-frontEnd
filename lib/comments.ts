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

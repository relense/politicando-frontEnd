"use client";

import { useQuery } from "@tanstack/react-query";
import { getComments } from "@/lib/api/client";
import { buildCommentTree } from "@/lib/comments";
import { commentsLabel } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";

type Props = { articleId: number; initialComments: Comment[] };

export function CommentSection({ articleId, initialComments }: Props) {
  const { data: comments = initialComments } = useQuery({
    queryKey: ["comments", articleId],
    queryFn: () => getComments(articleId),
    initialData: initialComments,
  });
  const tree = buildCommentTree(comments);

  return (
    <section aria-labelledby="comentarios" className="mt-8">
      <h2 id="comentarios" className="mb-4 text-lg font-bold">
        {commentsLabel(comments.length)}
      </h2>
      <CommentForm articleId={articleId} parentId={null} />
      {tree.length === 0 ? (
        <p className="mt-6 text-muted">Ainda não há comentários. Sê a primeira pessoa a comentar.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {tree.map((node) => (
            <li key={node.id}>
              <CommentItem node={node} articleId={articleId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

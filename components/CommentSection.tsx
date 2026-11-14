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
    <section aria-labelledby="comentarios" className="mt-10 border-t border-line pt-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id="comentarios" className="text-lg font-bold">
          {commentsLabel(comments.length)}
        </h2>
        {tree.length > 0 && (
          <a href="#novo-comentario" className="font-mono text-sm text-link underline">
            Comentar
          </a>
        )}
      </div>

      {tree.length === 0 ? (
        <p className="mb-6 text-muted">Ainda não há comentários. Sê a primeira pessoa a comentar.</p>
      ) : (
        <ul className="mb-8 flex flex-col gap-6">
          {tree.map((node) => (
            <li key={node.id}>
              <CommentItem node={node} articleId={articleId} />
            </li>
          ))}
        </ul>
      )}

      <div id="novo-comentario">
        <CommentForm articleId={articleId} parentId={null} />
      </div>
    </section>
  );
}

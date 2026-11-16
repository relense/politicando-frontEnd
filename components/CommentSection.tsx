"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { getComments } from "@/lib/api/client";
import { buildBacklinks, buildCommentTree } from "@/lib/comments";
import type { Comment } from "@/lib/types";
import { CommentForm, type CommentFormHandle } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import { CommentsContext } from "./CommentsContext";

type Props = { articleId: number; initialComments: Comment[] };
type Order = "oldest" | "newest";

export function CommentSection({ articleId, initialComments }: Props) {
  const { data: comments = initialComments } = useQuery({
    queryKey: ["comments", articleId],
    queryFn: () => getComments(articleId),
    initialData: initialComments,
  });
  const [order, setOrder] = useState<Order>("oldest");
  // The comment box starts as a single line and opens on click, as on Reddit.
  const [open, setOpen] = useState(false);
  const [initialText, setInitialText] = useState("");
  const form = useRef<CommentFormHandle>(null);

  const tree = buildCommentTree(comments);
  // Only the top-level order changes; replies always read oldest first, like a conversation.
  const roots = order === "newest" ? [...tree].reverse() : tree;

  const context = useMemo(
    () => ({
      byId: new Map(comments.map((comment) => [comment.id, comment])),
      backlinks: buildBacklinks(comments),
      quote: (id: number) => {
        const mention = `>>${id}\n`;
        if (form.current) return form.current.insert(mention);
        setInitialText(mention);
        setOpen(true);
      },
    }),
    [comments],
  );

  const openBox = () => {
    setInitialText("");
    setOpen(true);
  };

  return (
    <CommentsContext.Provider value={context}>
      <section aria-labelledby="comentarios" className="mt-12">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
          <h2 id="comentarios" className="font-mono text-sm font-bold uppercase tracking-widest">
            Comentários <span className="font-normal text-muted">({comments.length})</span>
          </h2>
          {tree.length > 1 && (
            <div role="group" aria-label="Ordenar comentários" className="flex gap-1 font-mono text-xs">
              {(["oldest", "newest"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={order === value}
                  onClick={() => setOrder(value)}
                  className={`rounded px-3 py-1.5 font-bold ${
                    order === value ? "bg-ink text-paper" : "border border-line text-muted hover:text-ink"
                  }`}
                >
                  {value === "oldest" ? "Mais antigos" : "Mais recentes"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div id="novo-comentario" className="mb-8 scroll-mt-24">
          {open ? (
            <CommentForm
              ref={form}
              articleId={articleId}
              parentId={null}
              initialText={initialText}
              autoFocus
              onPosted={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={openBox}
              className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-left text-muted hover:border-muted"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 fill-none stroke-current stroke-2">
                <path d="M4 4h12v9H8l-4 3z" strokeLinejoin="round" />
              </svg>
              Junta-te à conversa…
            </button>
          )}
        </div>

        {tree.length === 0 ? (
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line p-5">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--marker)_30%,transparent)] text-[color:var(--stage-debate)]"
            >
              <svg viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2">
                <path d="M4 4h12v9H8l-4 3z" strokeLinejoin="round" />
              </svg>
            </span>
            <p>
              <span className="block font-bold">Ainda não há comentários.</span>
              <span className="block text-sm text-muted">Sê a primeira pessoa a comentar. Não precisas de conta.</span>
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-6">
            {roots.map((node) => (
              <li key={node.id}>
                <CommentItem node={node} articleId={articleId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </CommentsContext.Provider>
  );
}

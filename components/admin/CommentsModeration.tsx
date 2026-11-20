"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  commentPlace,
  COMMENTS_PAGE,
  getComments,
  hideComment,
  unhideComment,
  type AdminComment,
  type CommentStatus,
} from "@/lib/api/admin";
import { formatDateTime } from "@/lib/format";
import { buttonClass, Empty, ErrorNote, inputClass, Tabs, useExpiry, useExpiryOf } from "./ui";

/** Every comment on the site, newest first: hide (with a reason, for the log) or show again. */
export function CommentsModeration() {
  const [status, setStatus] = useState<CommentStatus>("visible");
  const client = useQueryClient();
  const expiry = useExpiry();
  const comments = useInfiniteQuery({
    queryKey: ["admin-comments", status],
    queryFn: ({ pageParam }) => getComments(status, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length < COMMENTS_PAGE ? undefined : last.at(-1)?.id),
  });
  const toggle = useMutation({
    mutationFn: ({ comment, reason }: { comment: AdminComment; reason: string | null }) =>
      comment.hiddenAt ? unhideComment(comment.id) : hideComment(comment.id, reason),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-comments"] }),
    onError: expiry,
  });
  useExpiryOf(comments.error);
  const items = comments.data?.pages.flat() ?? [];

  return (
    <section aria-labelledby="comentarios-admin">
      <h1 id="comentarios-admin" className="mb-1 text-2xl font-bold">
        Comentários
      </h1>
      <p className="mb-4 text-sm text-muted">
        Os comentários das notícias, os mais recentes primeiro. Um comentário escondido sai do site; as respostas ficam, como respostas a um
        comentário removido.
      </p>
      <Tabs
        label="Que comentários"
        value={status}
        onChange={setStatus}
        options={[
          { value: "visible", label: "Visíveis" },
          { value: "hidden", label: "Escondidos" },
          { value: "all", label: "Todos" },
        ]}
      />
      <ErrorNote error={toggle.error ?? comments.error} />
      {comments.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : items.length === 0 ? (
        <Empty>Sem comentários aqui.</Empty>
      ) : (
        <ul aria-label="Comentários" className="flex flex-col gap-3">
          {items.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                busy={toggle.isPending && toggle.variables?.comment.id === comment.id}
                onToggle={(reason) => toggle.mutate({ comment, reason })}
              />
            </li>
          ))}
        </ul>
      )}
      {comments.hasNextPage && (
        <button
          type="button"
          disabled={comments.isFetchingNextPage}
          onClick={() => comments.fetchNextPage()}
          className={`${buttonClass()} mt-4`}
        >
          {comments.isFetchingNextPage ? "A carregar…" : "Carregar mais antigos"}
        </button>
      )}
    </section>
  );
}

function CommentRow({ comment, busy, onToggle }: { comment: AdminComment; busy: boolean; onToggle: (reason: string | null) => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const place = commentPlace(comment);
  return (
    <article className={`rounded-2xl border p-4 ${comment.hiddenAt ? "border-dashed border-line opacity-80" : "border-line"}`}>
      <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        <span className="font-bold text-ink">{comment.username?.trim() || "Anónimo"}</span>
        <span>#{comment.id}</span>
        {comment.parentId && <span>resposta a #{comment.parentId}</span>}
        <span aria-hidden="true">·</span>
        <span>{formatDateTime(comment.createdAt)}</span>
        {comment.hiddenAt && <span className="rounded-full border border-line px-2 py-0.5 text-ink">Escondido</span>}
      </p>
      {place && (
        <Link href={place.href} target="_blank" className="mb-2 block text-sm text-link underline">
          {place.label} ↗
        </Link>
      )}
      <p className="whitespace-pre-line break-words leading-relaxed">{comment.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {comment.hiddenAt ? (
          <button type="button" disabled={busy} onClick={() => onToggle(null)} className={buttonClass()}>
            Mostrar outra vez
          </button>
        ) : asking ? (
          <form
            className="flex w-full flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onToggle(reason.trim() || null);
              setAsking(false);
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Motivo (opcional)</span>
              <input
                value={reason}
                maxLength={200}
                placeholder="Motivo (opcional), ex.: Spam"
                onChange={(event) => setReason(event.target.value)}
                className={inputClass}
                autoFocus
              />
            </label>
            <button type="submit" disabled={busy} className={buttonClass("danger")}>
              Esconder
            </button>
            <button type="button" onClick={() => setAsking(false)} className={buttonClass()}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" disabled={busy} onClick={() => setAsking(true)} className={buttonClass("danger")}>
            Esconder…
          </button>
        )}
      </div>
    </article>
  );
}

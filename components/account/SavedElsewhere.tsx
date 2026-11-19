"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { useReader } from "@/lib/account";
import { useExtras } from "@/lib/accountExtras";
import { getSavedPage } from "@/lib/api/engagement";
import { editorialPath } from "@/lib/editorial";
import { excerpt, formatDateTime } from "@/lib/format";
import { SaveButton } from "./SaveButton";

/**
 * Beside the saved news: what only an account saves (blog posts, comments, forum threads and replies), from
 * `GET /me/saved`. Unsaving here takes it off at once.
 */
export function SavedElsewhere() {
  const reader = useReader();
  const extras = useExtras();
  const page = useQuery({ queryKey: ["saved-page"], queryFn: getSavedPage, enabled: Boolean(reader), refetchOnMount: "always" });
  if (!reader || !page.data) return null;
  const kept = extras.saved;
  const posts = page.data.editorial.filter((item) => kept.editorial.includes(item.id));
  const comments = page.data.comments.filter((item) => kept.comment.includes(item.id));
  const threads = page.data.threads.filter((item) => kept.thread.includes(item.id));
  const replies = page.data.replies.filter((item) => kept.reply.includes(item.id));
  if (posts.length + comments.length + threads.length + replies.length === 0) return null;

  return (
    <div className="mt-10 flex flex-col gap-8">
      {posts.length > 0 && (
        <Group id="guardados-blog" title="Artigos do blog">
          {posts.map((item) => (
            <Row key={item.id} kind="editorial" id={item.id} meta={`Blog · ${formatDateTime(item.publishedAt)}`}>
              <Link href={editorialPath(item.slug)} className="font-semibold hover:underline">
                {item.title}
              </Link>
              {item.subtitle && <p className="mt-0.5 text-sm text-muted">{item.subtitle}</p>}
            </Row>
          ))}
        </Group>
      )}
      {comments.length > 0 && (
        <Group id="guardados-comentarios" title="Comentários">
          {comments.map((item) => {
            const where = item.articleId
              ? `/article/${item.articleId}`
              : item.postSlug
                ? editorialPath(item.postSlug)
                : item.storyId
                  ? `/historias/${item.storyId}`
                  : null;
            return (
              <Row key={item.id} kind="comment" id={item.id} meta={`${item.username ?? "anon"} · ${formatDateTime(item.createdAt)}`}>
                {where ? (
                  <Link href={`${where}#comentario-${item.id}`} className="hover:underline">
                    {excerpt(item.body, 220)}
                  </Link>
                ) : (
                  <p>{excerpt(item.body, 220)}</p>
                )}
              </Row>
            );
          })}
        </Group>
      )}
      {threads.length > 0 && (
        <Group id="guardados-discussoes" title="Discussões no fórum">
          {threads.map((item) => (
            <Row
              key={item.id}
              kind="thread"
              id={item.id}
              meta={`${item.replyCount === 1 ? "1 resposta" : `${item.replyCount} respostas`} · ${formatDateTime(item.createdAt)}`}
            >
              <Link href={`/forum/${encodeURIComponent(item.board)}/${item.id}`} className="font-semibold hover:underline">
                {item.title}
              </Link>
            </Row>
          ))}
        </Group>
      )}
      {replies.length > 0 && (
        <Group id="guardados-respostas" title="Respostas no fórum">
          {replies.map((item) => (
            <Row key={item.id} kind="reply" id={item.id} meta={`Em «${item.threadTitle}» · ${formatDateTime(item.createdAt)}`}>
              <Link href={`/forum/${encodeURIComponent(item.board)}/${item.threadId}#post-${item.id}`} className="hover:underline">
                {excerpt(item.body, 220)}
              </Link>
            </Row>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-muted">
        {title}
      </h2>
      <ul className="divide-y divide-line rounded-2xl border border-line">{children}</ul>
    </section>
  );
}

function Row({
  kind,
  id,
  meta,
  children,
}: {
  kind: "editorial" | "comment" | "thread" | "reply";
  id: number;
  meta: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 p-3">
      <div className="min-w-0 flex-1">
        {children}
        <p className="mt-1 font-mono text-[11px] text-muted">{meta}</p>
      </div>
      <SaveButton kind={kind} id={id} compact />
    </li>
  );
}

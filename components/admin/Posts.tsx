"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { canModerate, getPosts, type AdminPostSummary } from "@/lib/api/admin";
import { KIND_LABELS } from "@/lib/editorial";
import { formatDateTime } from "@/lib/format";
import { useMe } from "./AdminShell";
import { buttonClass, Empty, ErrorNote, Tabs, useExpiry } from "./ui";

type Filter = "all" | "draft" | "published";

/** The blog's posts: authors see their own, moderators every one. Last edited first, as the API sends them. */
export function Posts() {
  const me = useMe();
  const expiry = useExpiry();
  const [filter, setFilter] = useState<Filter>("all");
  const posts = useQuery({ queryKey: ["admin-posts"], queryFn: getPosts });
  if (posts.isError) expiry(posts.error);
  const items = (posts.data ?? []).filter((post) => filter === "all" || post.status === filter);
  const count = (status: Filter) => (posts.data ?? []).filter((post) => status === "all" || post.status === status).length;

  return (
    <section aria-labelledby="artigos-admin">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 id="artigos-admin" className="text-2xl font-bold">
          Artigos do blog
        </h1>
        <Link href="/admin/artigos/novo" className={buttonClass("ink")}>
          Novo artigo
        </Link>
      </div>
      <p className="mb-4 text-sm text-muted">
        {canModerate(me)
          ? "Todos os artigos, opinião, podcasts, entrevistas e vídeos do blog, os editados mais recentemente primeiro. Podes editar qualquer um e escolher os que ficam em destaque na página inicial."
          : "Os teus artigos, os editados mais recentemente primeiro. Um rascunho só aparece no site quando o publicares."}
      </p>
      <Tabs
        label="Que artigos"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `Todos (${count("all")})` },
          { value: "draft", label: `Rascunhos (${count("draft")})` },
          { value: "published", label: `Publicados (${count("published")})` },
        ]}
      />
      <ErrorNote error={posts.error} />
      {posts.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : items.length === 0 ? (
        <Empty>
          {filter === "draft" ? "Não há rascunhos." : filter === "published" ? "Ainda não há artigos publicados." : "Ainda não há artigos."}{" "}
          <Link href="/admin/artigos/novo" className="font-bold text-ink underline">
            Escrever o primeiro
          </Link>
        </Empty>
      ) : (
        <ul aria-label="Artigos" className="divide-y divide-line rounded-2xl border border-line">
          {items.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PostRow({ post }: { post: AdminPostSummary }) {
  const published = post.status === "published";
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span className="min-w-0 flex-1">
        <Link href={`/admin/artigos/${post.id}`} className="block font-bold hover:underline">
          {post.title}
        </Link>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
          <span className={`rounded-full border px-2 py-0.5 ${published ? "border-ink text-ink" : "border-dashed border-line"}`}>
            {published ? "Publicado" : "Rascunho"}
          </span>
          {post.featured && <span className="rounded-full bg-[var(--marker)] px-2 py-0.5 text-ink">Em destaque</span>}
          <span>{KIND_LABELS[post.kind]}</span>
          <span>· {post.authorName}</span>
          <span>· editado {formatDateTime(post.updatedAt)}</span>
        </span>
      </span>
      {published && (
        <a href={`/editorial/${encodeURIComponent(post.slug)}`} target="_blank" rel="noopener" className={buttonClass()}>
          Ver no site<span className="sr-only"> (abre num novo separador)</span>
        </a>
      )}
      <Link href={`/admin/artigos/${post.id}`} aria-label={`Editar ${post.title}`} className={buttonClass()}>
        Editar
      </Link>
    </li>
  );
}

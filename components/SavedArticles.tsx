"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getArticlesByIds } from "@/lib/api/client";
import { useReaderPrefs } from "@/lib/readerPrefs";
import { ArticleCard } from "./ArticleCard";

/** The reader's saved news: the ids live in this browser, the articles come from the API (asked from the browser). */
export function SavedArticles() {
  const { saved } = useReaderPrefs();
  const ids = [...saved].reverse();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["saved-articles", ids.join(",")],
    queryFn: () => getArticlesByIds(ids),
    enabled: ids.length > 0,
  });

  if (ids.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-muted">
        Ainda não guardaste nenhuma notícia. Usa o botão <span aria-hidden="true">⋯</span>
        <span className="sr-only">«Mais opções»</span> numa notícia e escolhe «Guardar».{" "}
        <Link href="/" className="text-link underline">
          Ir para as notícias
        </Link>
      </p>
    );
  }
  if (isPending) return <p className="text-muted">A carregar…</p>;
  if (isError)
    return (
      <p role="alert" className="text-muted">
        Não foi possível carregar as notícias guardadas.{" "}
        <button type="button" onClick={() => void refetch()} className="text-link underline">
          Tentar novamente
        </button>
      </p>
    );

  // Newest saved first; an article that no longer exists is simply left out.
  const byId = new Map(data.map((article) => [article.id, article]));
  const articles = ids.map((id) => byId.get(id)).filter((article) => article !== undefined);
  return (
    <div className="flex flex-col gap-3.5">
      {articles.map((article) => (
        <div key={article.id}>
          <ArticleCard article={article} why="Está aqui porque a guardaste. Fica só neste navegador." />
        </div>
      ))}
    </div>
  );
}

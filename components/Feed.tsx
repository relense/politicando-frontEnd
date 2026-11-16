"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { FEED_PAGE_SIZE, getFeedPage } from "@/lib/api/client";
import { formatDayHeading, lisbonDay } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { ArticlePage } from "@/lib/types";
import { ArticleCard } from "./ArticleCard";

/** `partySlug` and `source` take one value or several (any of them). */
type Props = { initialPage: ArticlePage; partySlug?: string | string[]; q?: string; source?: string | string[] };

export function Feed({ initialPage, partySlug, q = "", source = "" }: Props) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery({
    // Each feed has its own key, so moving between pages can never mix feeds or lose scrolling.
    queryKey: ["feed", [partySlug ?? "home"].flat().join(","), q, [source].flat().join(",")],
    queryFn: ({ pageParam }) => getFeedPage({ party: partySlug, q, source, cursor: pageParam, limit: FEED_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
  });

  const now = useNow();

  // Cursor pages can overlap if new articles arrive while scrolling.
  const seen = new Set<number>();
  const articles = (data?.pages.flatMap((page) => page.articles) ?? []).filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });

  if (articles.length === 0 && !hasNextPage) {
    return (
      <p className="py-12 text-center text-muted">
        {q || source?.length
          ? "Nenhuma notícia encontrada. Experimenta outras palavras, outros partidos ou outros jornais."
          : "Ainda não há notícias aqui."}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {articles.map((article, index) => {
          // A heading whenever the day changes, as in a printed paper's sections.
          const day = lisbonDay(article.publishedAt);
          const newDay = day !== null && day !== lisbonDay(articles[index - 1]?.publishedAt);
          return (
            <Fragment key={article.id}>
              {newDay && (
                <h2
                  className={`border-b-2 border-ink pb-2 font-mono text-xs font-bold uppercase tracking-widest ${index > 0 ? "mt-10" : ""}`}
                  suppressHydrationWarning
                >
                  {formatDayHeading(article.publishedAt, now)}
                </h2>
              )}
              <ArticleCard article={article} />
            </Fragment>
          );
        })}
      </div>
      {/* No endless scrolling: a page of news, then a button, so the footer can be reached. */}
      <div aria-live="polite" className="py-8 text-center font-mono text-sm text-muted">
        {isFetchNextPageError ? (
          <span role="alert">
            Não foi possível carregar mais notícias.{" "}
            <button type="button" onClick={() => void fetchNextPage()} className="text-link underline">
              Tentar novamente
            </button>
          </span>
        ) : hasNextPage ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full border border-ink px-5 py-2.5 font-mono text-xs font-bold text-ink hover:bg-surface disabled:opacity-60"
          >
            {isFetchingNextPage ? "A carregar…" : articles.length === 0 ? "Procurar em notícias mais antigas" : "Carregar mais notícias"}
          </button>
        ) : (
          "Não há mais notícias."
        )}
      </div>
    </>
  );
}

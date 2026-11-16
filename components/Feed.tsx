"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useRef } from "react";
import { getFeedPage } from "@/lib/api/client";
import { formatDayHeading, lisbonDay } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { ArticlePage } from "@/lib/types";
import { ArticleCard } from "./ArticleCard";

type Props = { initialPage: ArticlePage; partySlug?: string; q?: string; source?: string };

export function Feed({ initialPage, partySlug, q = "", source = "" }: Props) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery({
    // Each feed has its own key, so moving between pages can never mix feeds or lose scrolling.
    queryKey: ["feed", partySlug ?? "home", q, source],
    queryFn: ({ pageParam }) => getFeedPage({ party: partySlug, q, source, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const canAutoLoad = hasNextPage && !isFetchingNextPage && !isFetchNextPageError;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canAutoLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canAutoLoad, fetchNextPage]);

  // Cursor pages can overlap if new articles arrive while scrolling.
  const seen = new Set<number>();
  const articles = (data?.pages.flatMap((page) => page.articles) ?? []).filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });

  if (articles.length === 0) {
    return (
      <p className="py-12 text-center text-muted">
        {q || source ? "Nenhuma notícia encontrada. Experimenta outras palavras ou outra fonte." : "Ainda não há notícias aqui."}
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
      <div ref={sentinelRef} aria-live="polite" className="py-8 text-center font-mono text-sm text-muted">
        {isFetchingNextPage && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-pulse rounded-full bg-[var(--stage-debate)]"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
            A carregar mais notícias…
          </span>
        )}
        {isFetchNextPageError && (
          <span role="alert">
            Não foi possível carregar mais notícias.{" "}
            <button type="button" onClick={() => void fetchNextPage()} className="text-link underline">
              Tentar novamente
            </button>
          </span>
        )}
        {!hasNextPage && "Não há mais notícias."}
      </div>
    </>
  );
}

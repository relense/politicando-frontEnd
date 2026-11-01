"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getFeedPage } from "@/lib/api/client";
import type { ArticlePage } from "@/lib/types";
import { ArticleCard } from "./ArticleCard";

type Props = { initialPage: ArticlePage; partySlug?: string };

export function Feed({ initialPage, partySlug }: Props) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery({
    // Each feed has its own key, so moving between pages can never mix feeds or lose scrolling.
    queryKey: ["feed", partySlug ?? "home"],
    queryFn: ({ pageParam }) => getFeedPage({ party: partySlug, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
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
    return <p className="py-12 text-center text-muted">Ainda não há notícias aqui.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <div ref={sentinelRef} aria-live="polite" className="py-8 text-center font-mono text-sm text-muted">
        {isFetchingNextPage && "A carregar mais notícias…"}
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

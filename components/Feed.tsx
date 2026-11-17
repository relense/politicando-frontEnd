"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, type ReactNode } from "react";
import { FEED_PAGE_SIZE } from "@/lib/api/client";
import { loadFeed } from "@/lib/api/feed";
import { NEWEST, orderKey, whyShown, type FeedOrder } from "@/lib/feedFilter";
import { isMuted, updateReaderPrefs, useReaderPrefs } from "@/lib/readerPrefs";
import { undoable } from "./ArticleMenu";
import { formatDayHeading, lisbonDay } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { ArticlePage } from "@/lib/types";
import type { StoryPage } from "@/lib/api/stories";
import { ArticleCard } from "./ArticleCard";
import { leadOf, StoryCard } from "./StoryCard";

/** `partySlug` and `source` take one value or several (any of them). */
type Props = {
  /** A page of articles, or of stories (one card per news told by several outlets, FEATURES.stories). */
  initialPage: ArticlePage | StoryPage;
  partySlug?: string | string[];
  q?: string;
  source?: string | string[];
  /** Only the stories with this tag (the "Em debate" row). */
  tag?: string;
  /** Newest first, or the most voted, commented or read of a period. */
  order?: FeedOrder;
  /** Boxes shown between the news on screens without the side column: each after that many news. */
  inserts?: { after: number; node: ReactNode }[];
};

export function Feed({ initialPage, partySlug, q = "", source = "", tag = "", order = NEWEST, inserts = [] }: Props) {
  const ranked = order.sort !== "recentes";
  const asStories = "stories" in initialPage;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery({
    // Each feed has its own key, so moving between pages can never mix feeds or lose scrolling.
    queryKey: [asStories ? "stories" : "feed", [partySlug ?? "home"].flat().join(","), q, [source].flat().join(","), tag, orderKey(order)],
    queryFn: ({ pageParam }) => loadFeed({ party: partySlug, q, source, tag, cursor: pageParam, limit: FEED_PAGE_SIZE }, order, asStories),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
    // Back from an article, as on Reddit: every page loaded so far is still there, unchanged, so the browser puts the
    // reader back on the same card. Kept for half an hour of reading (the default is 5 minutes) and not refetched on
    // return, which would move the cards under the reader. A full reload brings the latest news.
    gcTime: 30 * 60_000,
    refetchOnMount: false,
  });

  const now = useNow();
  // The reader's own choices (hidden articles, outlets and parties to see less of) apply here, in the browser, so the
  // shared feed stays cached for everyone.
  const prefs = useReaderPrefs();

  // One list for both kinds: what the card needs, when it was published, and which article ids hide it (a story is
  // hidden by hiding the version its card shows).
  type Entry = { key: number; date: string; hidden: boolean; undo: number; card: ReactNode };
  const entries: Entry[] = (data?.pages ?? []).flatMap((page): Entry[] =>
    "stories" in page
      ? page.stories.map((story) => {
          const lead = leadOf(story);
          return {
            key: story.id,
            date: story.lastPublishedAt,
            hidden: story.versions.some((item) => prefs.hidden.includes(item.articleId)),
            undo: lead.articleId,
            card: <StoryCard story={story} why={whyShown(order, story.parties)} />,
          };
        })
      : page.articles.map((article) => ({
          key: article.id,
          date: article.publishedAt,
          hidden: isMuted(prefs, article),
          undo: article.id,
          card: <ArticleCard article={article} why={whyShown(order, article.parties)} />,
        })),
  );
  // Cursor pages can overlap if new news arrive while scrolling.
  const seen = new Set<number>();
  const articles = entries.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
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
      <div className="flex flex-col gap-3.5">
        {articles.map((entry, index) => {
          // A heading whenever the day changes, as in a printed paper's sections.
          const day = lisbonDay(entry.date);
          // Ranked, days are mixed: each card already shows its own.
          const newDay = !ranked && day !== null && day !== lisbonDay(articles[index - 1]?.date);
          return (
            <Fragment key={entry.key}>
              {newDay && (
                <h2
                  className={`border-b-[1.5px] border-ink/80 pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${index > 0 ? "mt-[26px]" : ""}`}
                  suppressHydrationWarning
                >
                  {formatDayHeading(entry.date, now)}
                </h2>
              )}
              {entry.hidden
                ? // Just hidden from this card's menu: a line to undo it; hidden before, nothing at all.
                  undoable.has(entry.undo) && (
                    <p role="status" className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 sm:px-5">
                      <span className="font-bold">{undoable.get(entry.undo)!.message}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-full bg-line/70 px-4 py-2 font-mono text-sm font-bold hover:bg-line"
                        onClick={() => {
                          const { before } = undoable.get(entry.undo)!;
                          undoable.delete(entry.undo);
                          updateReaderPrefs(() => before);
                        }}
                      >
                        Desfazer
                      </button>
                    </p>
                  )
                : entry.card}
              {inserts
                .filter((insert) => insert.after === index + 1)
                .map((insert) => (
                  // A boxed note between the news: no rule around it, the box marks it off.
                  <div key={`insert-${insert.after}`} className="xl:hidden">
                    {insert.node}
                  </div>
                ))}
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

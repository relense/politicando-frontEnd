"use client";

import Link from "next/link";
import { useState } from "react";
import { commentsLabel, excerpt, formatDateTime } from "@/lib/format";
import { partyPath } from "@/lib/parties";
import type { Article } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";

type Props = {
  article: Article;
  headingLevel?: 1 | 2;
  /** Off on the article page, where the title would only link to itself. */
  linkTitle?: boolean;
};

export function ArticleCard({ article, headingLevel = 2, linkTitle = true }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const Heading = `h${headingLevel}` as const;
  const articlePath = `/article/${article.id}`;
  const date = formatDateTime(article.publishedAt);
  // Lists use a shorter teaser; the article page shows everything the API has.
  const text = linkTitle ? excerpt(article.excerpt) : article.excerpt;
  const showImage = article.imageUrl && !imageFailed;

  return (
    <article className="border-b border-line pb-6">
      <Heading className="mb-3 text-xl font-bold leading-snug sm:text-2xl">
        {linkTitle ? (
          <Link href={articlePath} className="hover:underline">
            {article.title}
          </Link>
        ) : (
          article.title
        )}
      </Heading>

      <div className="flex flex-col gap-4 sm:flex-row">
        {showImage && (
          <a
            href={article.url ?? articlePath}
            target={article.url ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="block shrink-0 sm:w-56"
          >
            {/* Article images come from arbitrary hosts, which next/image cannot allow-list. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.imageUrl!}
              alt={article.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="aspect-video w-full rounded object-cover"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          {text && (
            <p className="mb-3 leading-relaxed text-muted">
              {text}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
            {date && <time dateTime={article.publishedAt}>{date}</time>}
            {linkTitle && article.url ? (
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                {article.source}
                <span className="sr-only"> (abre num novo separador)</span>
              </a>
            ) : (
              <span>{article.source}</span>
            )}
            {linkTitle && (
              <Link href={articlePath} className="text-link underline">
                {commentsLabel(article.commentsCount)}
              </Link>
            )}
          </div>
        </div>
      </div>

      {!linkTitle && article.url && (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded bg-ink px-4 py-2 font-mono text-sm font-bold text-paper hover:opacity-90"
        >
          Ler o artigo completo em {article.source}
          <span className="sr-only"> (abre num novo separador)</span>
        </a>
      )}

      {article.parties.length > 0 && (
        <ul aria-label="Partidos mencionados" className="mt-3 flex flex-wrap gap-2">
          {article.parties.map((party) => (
            <li key={party.slug}>
              <Link href={partyPath(party.slug)} className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-1.5 pr-3 font-mono text-xs hover:bg-surface">
                <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
                {party.acronym}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

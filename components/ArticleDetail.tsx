import type { ReactNode } from "react";
import { ArticleKindLabel } from "@/components/ArticleKind";
import { formatFullDateTime, readsLabel } from "@/lib/format";
import type { Article } from "@/lib/types";
import { ArticleActions } from "./ArticleActions";
import { ArticleImage } from "./ArticleImage";
import { BackLink } from "./BackLink";
import { PeopleInNews } from "./PeopleInNews";
import { PartyChips } from "./PartyChips";
import { outletClick } from "@/lib/analytics";

/** The article page's main column. We only have a teaser, so the way to the original is the main action. */
export function ArticleDetail({
  article,
  versions,
  updated,
}: {
  article: Article;
  /** The story's outlets, as tabs. */
  versions?: ReactNode;
  /** Under the headline: the story's newest later piece. */
  updated?: ReactNode;
}) {
  const published = formatFullDateTime(article.publishedAt);

  return (
    <article>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <ArticleActions title={article.title} />
      </div>

      {versions}
      <p className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        <span className="rounded-full bg-surface px-2.5 py-0.5 font-bold text-ink">{article.source}</span>
        {published && <time dateTime={article.publishedAt}>{published}</time>}
        {article.views !== null && article.views > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>{readsLabel(article.views)}</span>
          </>
        )}
      </p>
      <ArticleKindLabel kind={article.kind} className="-mt-2 mb-3" />

      <h1 className="text-2xl font-bold leading-tight sm:text-3xl xl:text-4xl xl:leading-[1.1]">{article.title}</h1>
      {updated}

      {article.excerpt && <p className="mt-4 text-lg leading-relaxed text-ink/90">{article.excerpt}</p>}

      {article.imageUrl && (
        <>
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            backdrop
            caption={`Imagem · ${article.source}`}
            className="mt-6 flex aspect-video justify-center overflow-hidden rounded-2xl bg-surface"
            imageClassName="relative h-full w-auto max-w-full object-contain"
          />
        </>
      )}

      {article.url && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[color:var(--stage-debate)]/40 bg-[color-mix(in_srgb,var(--marker)_14%,transparent)] p-5 sm:flex-row sm:items-center sm:gap-6">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            {...outletClick(article.url, "article-page")}
            className="shrink-0 rounded-lg bg-[#f0c75e] px-5 py-3 text-center font-mono text-sm font-bold text-[#1a1a1a] hover:opacity-90"
          >
            Ler o artigo completo em {article.source}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (abre num novo separador)</span>
          </a>
          <p className="font-mono text-xs leading-relaxed text-muted">
            O Politicando mostra só um excerto. O artigo e a imagem pertencem à publicação original.
          </p>
        </div>
      )}

      {article.parties.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted">Partidos na notícia</span>
          <PartyChips parties={article.parties} />
        </div>
      )}
      <PeopleInNews people={article.people ?? []} className="mt-4" />
    </article>
  );
}

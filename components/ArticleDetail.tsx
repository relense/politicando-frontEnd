import { formatLongDateTime } from "@/lib/format";
import type { Article } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";
import { BackLink } from "./BackLink";
import { PartyChips } from "./PartyChips";
import { ShareButton } from "./ShareButton";

/** The article page. We only have a teaser, so the way to the original is the main action. */
export function ArticleDetail({ article }: { article: Article }) {
  const published = formatLongDateTime(article.publishedAt);

  return (
    <article>
      <div className="mb-8 flex items-center justify-between gap-4">
        <BackLink />
        <ShareButton title={article.title} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-2 font-mono text-sm text-muted">
        <span className="font-bold text-ink">{article.source}</span>
        {published && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={article.publishedAt ?? undefined}>{published}</time>
          </>
        )}
      </div>

      <h1 className="mb-4 text-2xl font-bold leading-tight sm:text-[1.75rem]">{article.title}</h1>

      <PartyChips parties={article.parties} className="mb-5" />

      {article.imageUrl && (
        <ArticleImage
          src={article.imageUrl}
          caption={`Imagem · ${article.source}`}
          className="mb-5 flex justify-center overflow-hidden rounded-lg bg-surface"
          imageClassName="max-h-[28rem] w-auto max-w-full object-contain"
        />
      )}

      {article.excerpt && <p className="text-base leading-relaxed sm:text-[17px]">{article.excerpt}</p>}

      {article.url && (
        <div className="mt-8 flex flex-col gap-4 border-y border-line py-6 sm:flex-row sm:items-center sm:gap-6">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded bg-ink px-6 py-3.5 text-center font-mono text-sm font-bold text-paper hover:opacity-90"
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
    </article>
  );
}

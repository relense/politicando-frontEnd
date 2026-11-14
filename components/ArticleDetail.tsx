import type { Article } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";
import { PartyChips } from "./PartyChips";
import { RelativeTime } from "./RelativeTime";
import { ShareButton } from "./ShareButton";

/** The article page. We only have a teaser, so the way to the original is the main action. */
export function ArticleDetail({ article }: { article: Article }) {
  return (
    <article>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 font-mono text-xs uppercase tracking-wider text-muted">
        <span className="font-bold text-ink">{article.source}</span>
        <span aria-hidden="true">·</span>
        <RelativeTime value={article.publishedAt} />
      </div>

      <h1 className="mb-4 text-2xl font-bold leading-tight sm:text-4xl">{article.title}</h1>

      <PartyChips parties={article.parties} className="mb-6" />

      {article.imageUrl && (
        <ArticleImage src={article.imageUrl} className="mb-6" imageClassName="aspect-video w-full rounded-lg object-cover" />
      )}

      {article.excerpt && <p className="text-lg leading-relaxed">{article.excerpt}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-ink px-4 py-2 font-mono text-sm font-bold text-paper hover:opacity-90"
          >
            Ler o artigo completo em {article.source}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (abre num novo separador)</span>
          </a>
        )}
        <ShareButton title={article.title} />
      </div>
    </article>
  );
}

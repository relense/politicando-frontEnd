import Link from "next/link";
import { commentLinkLabel, excerpt, formatCardWhen, formatDateTime } from "@/lib/format";
import type { Article } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";
import { CommentIcon } from "./icons";
import { PartyChips } from "./PartyChips";

/** A feed entry. Everything opens our article page except the outlet link, which goes to the original. */
export function ArticleCard({ article }: { article: Article }) {
  const articlePath = `/article/${article.id}`;
  const text = excerpt(article.excerpt);

  return (
    <article className="grid gap-x-8 gap-y-4 border-b border-line py-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted">
          {article.url ? (
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ink hover:underline">
              {article.source}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (abre num novo separador)</span>
            </a>
          ) : (
            <span className="font-bold text-ink">{article.source}</span>
          )}
          <span aria-hidden="true">·</span>
          {/* The day too, not only the feed's day heading: it scrolls away. */}
          <time dateTime={article.publishedAt} title={formatDateTime(article.publishedAt) ?? undefined}>
            {formatCardWhen(article.publishedAt)}
          </time>
        </div>

        <h2 className="mb-2 text-lg font-bold leading-snug sm:text-xl">
          <Link href={articlePath} className="hover:underline">
            {article.title}
          </Link>
        </h2>

        {text && <p className="mb-3 text-[15px] leading-relaxed text-ink/80">{text}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <PartyChips parties={article.parties} />
          <Link
            href={`${articlePath}#comentarios`}
            className="ml-auto flex items-center gap-1.5 font-mono text-sm text-muted hover:text-ink hover:underline"
          >
            <CommentIcon />
            {commentLinkLabel(article.commentsCount)}
          </Link>
        </div>
      </div>

      {article.imageUrl && (
        <ArticleImage
          src={article.imageUrl}
          href={articlePath}
          caption={`Imagem · ${article.source}`}
          className="order-first block self-start overflow-hidden rounded-lg sm:order-none"
          imageClassName="aspect-[3/2] w-full object-cover"
        />
      )}
    </article>
  );
}

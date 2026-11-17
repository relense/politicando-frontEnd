import { SourceLogo } from "./SourceLogo";
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
    <article className="relative -mx-3 grid gap-x-8 gap-y-4 rounded-2xl border-b border-line px-3 py-5 transition-colors hover:border-transparent hover:bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] sm:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="min-w-0">
        <div className="relative z-10 mb-2 flex w-fit flex-wrap items-center gap-x-2 font-mono text-xs text-muted">
          {article.url ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-ink hover:underline"
            >
              <SourceLogo domain={article.sourceDomain} name={article.source} size={18} />
              {article.source}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (abre num novo separador)</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-bold text-ink">
              <SourceLogo domain={article.sourceDomain} name={article.source} size={18} />
              {article.source}
            </span>
          )}
          <span aria-hidden="true">·</span>
          {/* The day too, not only the feed's day heading: it scrolls away. */}
          <time dateTime={article.publishedAt} title={formatDateTime(article.publishedAt) ?? undefined}>
            {formatCardWhen(article.publishedAt)}
          </time>
        </div>

        <h2 className="mb-2 text-lg font-bold leading-snug sm:text-xl">
          {/* The whole card opens the story; the links on it stay on top. */}
          <Link href={articlePath} className="after:absolute after:inset-0 after:rounded-2xl">
            {article.title}
          </Link>
        </h2>

        {text && <p className="mb-3 text-[15px] leading-relaxed text-ink/80">{text}</p>}

        {/* The chips wrap in their own column, so the comments pill always stays on the first row, at the right. */}
        <div className="relative z-10 flex items-start gap-3">
          <PartyChips parties={article.parties} className="min-w-0 flex-1" />
          <Link
            href={`${articlePath}#comentarios`}
            aria-label={commentLinkLabel(article.commentsCount)}
            className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-mono text-sm hover:bg-line hover:text-ink ${article.commentsCount > 0 ? "text-ink" : "text-muted"}`}
          >
            <CommentIcon />
            <span>
              <span className="font-bold tabular-nums">{article.commentsCount}</span>
              {/* On a phone the number alone, so the pill fits beside the chips. */}
              <span className="max-sm:hidden">{article.commentsCount === 1 ? " comentário" : " comentários"}</span>
            </span>
          </Link>
        </div>
      </div>

      {article.imageUrl && (
        <ArticleImage
          src={article.imageUrl}
          href={articlePath}
          caption={`Imagem · ${article.source}`}
          className="relative z-10 order-first block self-start overflow-hidden rounded-lg sm:order-none"
          imageClassName="aspect-[3/2] w-full object-cover"
        />
      )}
    </article>
  );
}

import Link from "next/link";
import { ArticleKindLabel } from "@/components/ArticleKind";
import { excerpt, formatCardWhen, formatDateTime, formatNumber, readsLabel } from "@/lib/format";
import type { Article } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";
import { ArticleMenu } from "./ArticleMenu";
import { ArticleVote } from "./ArticleVote";
import { CardShare } from "./CardShare";
import { cardAction, cardActions, cardBox, cardExcerpt, cardImage, cardMeta, cardReadOn, cardTitle, cardTitleLink } from "./feedCard";
import { CommentIcon } from "./icons";
import { PartyChips } from "./PartyChips";
import { SourceLogo } from "./SourceLogo";
import { outletClick } from "@/lib/analytics";

/**
 * A feed entry, as a card: who published it, when and how many read it; the title and excerpt; the photo, whole; the
 * parties; then the actions as round pills (votes, comments, share) and the way to the original. The card opens our
 * article page; the outlet, the parties and the actions keep their own links.
 */
export function ArticleCard({
  article,
  why,
}: {
  article: Article;
  /** "Porque vejo isto?", which also turns the menu on. */ why?: string;
}) {
  const articlePath = `/article/${article.id}`;
  const text = excerpt(article.excerpt);

  return (
    <article className={cardBox}>
      <div className="flex items-center justify-between gap-2.5">
        <p className={cardMeta}>
          {article.url ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              {...outletClick(article.url, "card-source")}
              className="inline-flex items-center gap-2.5 font-semibold text-ink hover:underline"
            >
              <SourceLogo domain={article.sourceDomain} name={article.source} size={30} square />
              {article.source}
              <span className="sr-only"> (abre num novo separador)</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-2.5 font-semibold text-ink">
              <SourceLogo domain={article.sourceDomain} name={article.source} size={30} square />
              {article.source}
            </span>
          )}
          <span aria-hidden="true">·</span>
          {/* The day too, not only the feed's day heading: it scrolls away. */}
          <time dateTime={article.publishedAt} title={formatDateTime(article.publishedAt) ?? undefined}>
            {formatCardWhen(article.publishedAt)}
          </time>
          {article.views !== null && article.views > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{readsLabel(article.views)}</span>
            </>
          )}
        </p>
        {why !== undefined && <ArticleMenu article={article} why={why} />}
      </div>
      <ArticleKindLabel kind={article.kind} className="mt-1" />

      <h2 className={cardTitle}>
        {/* The whole card opens the story; the links on it stay on top. */}
        <Link href={articlePath} className={cardTitleLink}>
          {article.title}
        </Link>
      </h2>

      {text && <p className={cardExcerpt}>{text}</p>}

      <ArticleImage
        src={article.imageUrl}
        alt={article.title}
        href={articlePath}
        caption={`Imagem · ${article.source}`}
        source={article.source}
        sourceDomain={article.sourceDomain}
        className={cardImage}
        imageClassName="size-full object-cover"
      />

      {article.parties.length > 0 && <PartyChips parties={article.parties} className="relative z-10 mt-2.5" />}

      <div className={cardActions}>
        {article.votes && <ArticleVote id={article.id} title={article.title} up={article.votes.up} down={article.votes.down} />}
        <Link href={`${articlePath}#comentarios`} className={cardAction}>
          <CommentIcon />
          {/* On a phone the number alone, so the row fits; the word stays for screen readers. */}
          <span>
            <span className="tabular-nums">{formatNumber(article.commentsCount)}</span>{" "}
            <span className="max-sm:sr-only">{article.commentsCount === 1 ? "comentário" : "comentários"}</span>
          </span>
        </Link>
        <CardShare path={articlePath} title={article.title} className={cardAction} compact />
        {article.url && (
          <a href={article.url} target="_blank" rel="noopener noreferrer" {...outletClick(article.url, "card")} className={cardReadOn}>
            Ler em {article.source}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (abre num novo separador)</span>
          </a>
        )}
      </div>
    </article>
  );
}

import Link from "next/link";
import { commentLinkLabel, excerpt } from "@/lib/format";
import type { Article } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";
import { PartyChips } from "./PartyChips";
import { RelativeTime } from "./RelativeTime";

/** A feed entry. Everything opens our article page except the outlet link, which goes to the original. */
export function ArticleCard({ article }: { article: Article }) {
  const articlePath = `/article/${article.id}`;
  const text = excerpt(article.excerpt);

  return (
    <article className="border-b border-line pb-6">
      <h2 className="mb-3 text-xl font-bold leading-snug sm:text-2xl">
        <Link href={articlePath} className="hover:underline">
          {article.title}
        </Link>
      </h2>

      <div className="flex flex-col gap-4 sm:flex-row">
        {article.imageUrl && (
          <ArticleImage
            src={article.imageUrl}
            href={articlePath}
            className="block shrink-0 sm:w-56"
            imageClassName="aspect-video w-full rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          {text && <p className="mb-3 leading-relaxed text-muted">{text}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
            <RelativeTime value={article.publishedAt} />
            {article.url ? (
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                {article.source}
                <span className="sr-only"> (abre num novo separador)</span>
              </a>
            ) : (
              <span>{article.source}</span>
            )}
            <Link href={`${articlePath}#comentarios`} className="hover:text-ink hover:underline">
              {commentLinkLabel(article.commentsCount)}
            </Link>
          </div>
        </div>
      </div>

      <PartyChips parties={article.parties} className="mt-3" />
    </article>
  );
}

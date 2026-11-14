import Link from "next/link";
import type { Article } from "@/lib/types";
import { RelativeTime } from "./RelativeTime";

export function RelatedArticles({ title, articles }: { title: string; articles: Article[] }) {
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="relacionadas" className="mt-12 border-t border-line pt-6">
      <h2 id="relacionadas" className="mb-2 font-mono text-sm font-bold uppercase tracking-widest text-muted">
        {title}
      </h2>
      <ul className="divide-y divide-line">
        {articles.map((article) => (
          <li key={article.id} className="py-3">
            <Link href={`/article/${article.id}`} className="font-bold leading-snug hover:underline">
              {article.title}
            </Link>
            <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-xs text-muted">
              <span>{article.source}</span>
              <span aria-hidden="true">·</span>
              <RelativeTime value={article.publishedAt} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

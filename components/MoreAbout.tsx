"use client";

import Link from "next/link";
import { useState } from "react";
import { formatRelative } from "@/lib/format";
import { partyPath } from "@/lib/parties";
import { useNow } from "@/lib/useNow";

export type MoreAboutGroup = {
  slug: string;
  acronym: string;
  articles: { id: number; title: string; source: string; publishedAt: string }[];
};

/** More news about each party in the article, one tab per party. */
export function MoreAbout({ groups }: { groups: MoreAboutGroup[] }) {
  const [active, setActive] = useState(groups[0]?.slug ?? "");
  const now = useNow();
  const group = groups.find((item) => item.slug === active) ?? groups[0];
  if (!group) return null;
  return (
    <section aria-labelledby="mais-sobre" className="rounded-2xl border border-line p-4">
      <h2 id="mais-sobre" className="font-mono text-xs font-bold uppercase tracking-widest">
        Mais sobre
      </h2>
      {groups.length > 1 && (
        <div role="group" aria-label="Partido" className="mt-3 inline-flex overflow-hidden rounded-lg border border-line">
          {groups.map((item) => (
            <button
              key={item.slug}
              type="button"
              aria-pressed={item.slug === group.slug}
              onClick={() => setActive(item.slug)}
              className={`border-r border-line px-3 py-1 font-mono text-xs font-bold last:border-0 ${
                item.slug === group.slug ? "bg-ink text-paper" : "hover:bg-surface"
              }`}
            >
              {item.acronym}
            </button>
          ))}
        </div>
      )}
      {group.articles.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sem outras notícias sobre o {group.acronym} por agora.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {group.articles.map((article) => (
            <li key={article.id} className="py-2.5">
              <Link href={`/article/${article.id}`} className="block font-bold leading-snug hover:underline">
                {article.title}
              </Link>
              <span className="mt-0.5 block font-mono text-[11px] text-muted" suppressHydrationWarning>
                {article.source} · {formatRelative(article.publishedAt, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={partyPath(group.slug)}
        className="mt-2 inline-block rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
      >
        Todas as notícias do {group.acronym}
      </Link>
    </section>
  );
}

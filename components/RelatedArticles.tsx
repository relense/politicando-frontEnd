import Link from "next/link";
import type { Article } from "@/lib/types";
import { RelativeTime } from "./RelativeTime";

const SHOWN = 6;

/** "Notícias sobre esta proposta": the news about it, newest first, as a timeline; the rest folded. */
export function ProposalNews({ articles, more }: { articles: Article[]; more?: { href: string; label: string } }) {
  if (articles.length === 0) return null;
  const sorted = [...articles].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const item = (article: Article) => (
    <li key={article.id}>
      <Link href={`/article/${article.id}`} className="text-sm font-semibold leading-snug hover:underline">
        {article.title}
      </Link>
      <p className="mt-0.5 font-mono text-[11px] text-muted">
        {article.source} · <RelativeTime value={article.publishedAt} />
      </p>
    </li>
  );
  const rest = sorted.slice(SHOWN);
  return (
    <section id="noticias" aria-labelledby="noticias-proposta" className="scroll-mt-24 rounded-2xl border border-line p-4">
      <h2
        id="noticias-proposta"
        className="flex justify-between gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted"
      >
        Notícias sobre esta proposta
        <span className="font-normal normal-case tracking-normal">{sorted.length}</span>
      </h2>
      <ol className="mt-2 flex flex-col gap-3 border-l-2 border-line pl-3">{sorted.slice(0, SHOWN).map(item)}</ol>
      {rest.length > 0 && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none font-mono text-[11px] font-bold underline underline-offset-2 group-open:hidden">
            Mais {rest.length} {rest.length === 1 ? "notícia" : "notícias"}
          </summary>
          <ol className="flex flex-col gap-3 border-l-2 border-line pl-3">{rest.map(item)}</ol>
        </details>
      )}
      {more && (
        <Link href={more.href} className="mt-3 inline-block font-mono text-[11px] font-bold underline">
          {more.label}
        </Link>
      )}
    </section>
  );
}

import Link from "next/link";
import { tidyName } from "@/lib/elections";
import { partyPath } from "@/lib/parties";
import type { ArticleParty } from "@/lib/types";
import { MoreAbout, type MoreAboutGroup } from "./MoreAbout";
import { PartyLogo } from "./PartyLogo";

export type ArticleContext = { kicker: string; title: string; linkLabel: string; href: string };

const box = "rounded-2xl border border-line p-4";
const label = "font-mono text-xs font-bold uppercase tracking-widest";

/** Beside the article: the parties in it with their forums, more about them, the context in Parliament, and the map. */
export function ArticleSidebar({
  articleId,
  parties,
  more,
  context,
  top,
}: {
  /** First in the column: the story's Importa box. */
  top?: React.ReactNode;
  articleId: number;
  parties: ArticleParty[];
  more: MoreAboutGroup[];
  context: ArticleContext | null;
}) {
  return (
    <aside
      aria-label="Sobre esta notícia"
      className="no-scrollbar flex flex-col gap-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain xl:pb-2"
    >
      {top}
      <section aria-labelledby="partidos-noticia" className={box}>
        <h2 id="partidos-noticia" className={label}>
          {parties.length > 0 ? "Partidos nesta notícia" : "Discutir"}
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {parties.map((party) => (
            <li key={party.slug} className="flex items-center gap-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
                <PartyLogo slug={party.slug} acronym={party.acronym} size={28} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug">{tidyName(party.name)}</span>
                <Link href={partyPath(party.slug)} className="font-mono text-[11px] text-muted hover:text-ink hover:underline">
                  Página do partido <span aria-hidden="true">→</span>
                </Link>
              </span>
              <Link
                href={`/forum/${party.slug}?artigo=${articleId}#nova`}
                aria-label={`Discutir no fórum do ${party.acronym}`}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-xs font-bold hover:bg-surface"
              >
                Fórum
              </Link>
            </li>
          ))}
          {parties.length === 0 && (
            <li className="py-2.5">
              <Link
                href={`/forum/geral?artigo=${articleId}#nova`}
                className="inline-block rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
              >
                Discutir no fórum geral
              </Link>
            </li>
          )}
        </ul>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
          Cada partido tem um fórum próprio para discussões que vão além de uma notícia.
        </p>
      </section>

      {more.length > 0 && <MoreAbout groups={more} />}

      {context && (
        <Link href={context.href} className={`${box} block bg-surface/60 hover:bg-surface`}>
          <span className={`${label} block text-[color:var(--stage-president)]`}>{context.kicker}</span>
          <span className="mt-2 block font-bold leading-snug">{context.title}</span>
          <span className="mt-2 block font-mono text-xs text-muted">
            {context.linkLabel} <span aria-hidden="true">→</span>
          </span>
        </Link>
      )}

      <Link href="/sitios" className={`${box} block hover:bg-surface`}>
        <span className={`${label} block text-muted`}>Autarquias</span>
        <span className="mt-2 block font-bold leading-snug">Quem governa a tua câmara?</span>
        <span className="mt-1 block font-mono text-xs text-muted">
          Procura o teu concelho <span aria-hidden="true">→</span>
        </span>
      </Link>
    </aside>
  );
}

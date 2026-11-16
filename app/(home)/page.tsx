import type { Metadata } from "next";
import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { loadHighlights } from "@/components/Highlights";
import { BlogSpotlight, loadNewsSidebar, MostCommented, PowerNow } from "@/components/NewsSidebar";
import { NewsSearch } from "@/components/NewsSearch";
import { PartyChipBar } from "@/components/PartyNav";
import { getFeedPage, getParties, getSources } from "@/lib/api/client";
import { tidyName } from "@/lib/elections";
import { ofParty, partyPath } from "@/lib/parties";
import { SOURCE_COUNT, sourceName } from "@/lib/sources";

type Props = { searchParams: Promise<{ partido?: string | string[]; q?: string | string[]; fonte?: string | string[] }> };

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
/** The words searched, tidied; an outlet only when it looks like a domain. */
const searchOf = (params: { q?: string | string[]; fonte?: string | string[] }) => ({
  q: one(params.q).trim().replace(/\s+/g, " ").slice(0, 100),
  source: /^[a-z0-9.-]{3,80}$/.test(one(params.fonte)) ? one(params.fonte) : "",
});

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const { partido } = params;
  const { q, source } = searchOf(params);
  // Search results are not pages of their own.
  if (q || source) return { robots: { index: false, follow: true } };
  // A filtered feed repeats the party's page, which is the one to index.
  return typeof partido === "string" && partido
    ? { alternates: { canonical: partyPath(partido) }, robots: { index: false, follow: true } }
    : {};
}

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

export default async function HomePage({ searchParams }: Props) {
  await connection();
  const [params, parties, sources] = await Promise.all([searchParams, getParties().catch(() => []), getSources().catch(() => [])]);
  const { partido } = params;
  const { q, source } = searchOf(params);
  // Only a party we know filters the feed; anything else shows every party.
  const party = parties.find((item) => item.slug === partido) ?? null;
  // The full name in the title ("Notícias do Partido Social Democrata"), the acronym in the smaller lines.
  const partyName = party ? tidyName(party.name) : null;
  const [page, highlights, sidebar] = await Promise.all([
    getFeedPage({ party: party?.slug, q, source }),
    loadHighlights(),
    loadNewsSidebar(),
  ]);
  // The blog has one box beside the news, so it never pushes the news down.
  const spotlight = highlights[0] ?? null;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          {SOURCE_COUNT} órgãos de comunicação · {party ? party.acronym : "todos os partidos"}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {party ? (
            <>
              Notícias {ofParty(partyName!)} <span className={MARKER}>{partyName}</span>
            </>
          ) : (
            <>
              Últimas <span className={MARKER}>notícias</span>
            </>
          )}
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          {party
            ? `Tudo o que se publica sobre ${ofParty(partyName!) === "da" ? "a" : "o"} ${party.acronym}, num só lugar e por ordem de publicação. Lê, compara e comenta.`
            : "Tudo o que se publica sobre os partidos portugueses, num só lugar e por ordem de publicação. Lê, compara e comenta."}
        </p>
      </header>

      <PartyChipBar parties={parties} active={party?.slug ?? null} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <NewsSearch
            key={`${q}|${source}`}
            q={q}
            source={source}
            partySlug={party?.slug ?? null}
            sources={sources.map((item) => ({ domain: item.domain, name: sourceName(item.domain) }))}
          />
          <p className="mb-4 font-mono text-xs text-muted" aria-live="polite">
            {q || source ? (
              <>
                {q ? `Notícias com «${q}»` : "Notícias"}
                {source && ` · ${sourceName(source)}`}
                {party && ` sobre ${ofParty(partyName!) === "da" ? "a" : "o"} ${party.acronym}`}, mais recentes primeiro
              </>
            ) : (
              <>{party ? `Notícias ${ofParty(partyName!)} ${party.acronym}` : "Todas as notícias"}, mais recentes primeiro</>
            )}
          </p>
          {/* On smaller screens the blog's box comes before the news, and the rest of the column is left out. */}
          {spotlight && (
            <div className="mb-6 xl:hidden">
              <BlogSpotlight post={spotlight} />
            </div>
          )}
          <Feed key={`${party?.slug ?? "todas"}|${q}|${source}`} initialPage={page} partySlug={party?.slug} q={q} source={source} />
        </div>
        <aside aria-label="Ao lado das notícias" className="hidden xl:block">
          <div className="no-scrollbar sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto overscroll-contain pb-2">
            {spotlight && <BlogSpotlight post={spotlight} />}
            <PowerNow data={sidebar.power} />
            <MostCommented articles={sidebar.mostCommented} />
          </div>
        </aside>
      </div>
    </div>
  );
}

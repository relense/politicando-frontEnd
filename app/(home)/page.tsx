import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { loadHighlights } from "@/components/Highlights";
import { BlogSpotlight, loadNewsSidebar, MostCommented, PowerNow } from "@/components/NewsSidebar";
import { NewsSearch } from "@/components/NewsSearch";
import { FeedFilters } from "@/components/FeedFilters";
import { FEED_PAGE_SIZE, getFeedPage, getParties, getSources } from "@/lib/api/client";
import { tidyName } from "@/lib/elections";
import { FEED_COOKIE, isEmpty, parseFilter, readSavedFilter } from "@/lib/feedFilter";
import { ofParty, partyPath } from "@/lib/parties";
import { SOURCE_COUNT, sourceName } from "@/lib/sources";

type Props = {
  searchParams: Promise<{ partido?: string | string[]; q?: string | string[]; fonte?: string | string[]; tudo?: string | string[] }>;
};

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
/** The words searched, tidied. */
const searchOf = (params: { q?: string | string[] }) => ({ q: one(params.q).trim().replace(/\s+/g, " ").slice(0, 100) });

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const { q } = searchOf(params);
  const filter = parseFilter(params);
  // Search results and filtered feeds are not pages of their own; one party's news repeats its page, the one to index.
  if (q || filter.sources.length > 0 || filter.parties.length > 1) return { robots: { index: false, follow: true } };
  return filter.parties.length === 1
    ? { alternates: { canonical: partyPath(filter.parties[0]!) }, robots: { index: false, follow: true } }
    : {};
}

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

export default async function HomePage({ searchParams }: Props) {
  await connection();
  const [params, parties, sources, jar] = await Promise.all([
    searchParams,
    getParties().catch(() => []),
    getSources().catch(() => []),
    cookies(),
  ]);
  const { q } = searchOf(params);
  const saved = readSavedFilter(jar.get(FEED_COOKIE)?.value);
  const asked = parseFilter(params);
  // The front page opens with the reader's saved feed, unless the address asks for something (or for everything).
  const fromSaved = Boolean(saved && isEmpty(asked) && !q && !params.tudo);
  const wanted = fromSaved ? saved! : asked;
  // Only parties and outlets we know filter the feed; anything else is dropped.
  const chosen = {
    parties: wanted.parties.filter((slug) => parties.some((item) => item.slug === slug)),
    sources: sources.length > 0 ? wanted.sources.filter((domain) => sources.some((item) => item.domain === domain)) : wanted.sources,
  };
  const party =
    chosen.parties.length === 1 && chosen.sources.length === 0 ? parties.find((item) => item.slug === chosen.parties[0])! : null;
  // The full name in the title ("Notícias do Partido Social Democrata"), the acronym in the smaller lines.
  const partyName = party ? tidyName(party.name) : null;
  const filtered = !isEmpty(chosen);
  const label = [
    chosen.parties.map((slug) => parties.find((item) => item.slug === slug)?.acronym ?? slug).join(", "),
    chosen.sources.map(sourceName).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const [page, highlights, sidebar] = await Promise.all([
    getFeedPage({ party: chosen.parties, q, source: chosen.sources, limit: FEED_PAGE_SIZE }),
    loadHighlights(),
    loadNewsSidebar(),
  ]);
  // The blog has one box beside the news, so it never pushes the news down.
  const spotlight = highlights[0] ?? null;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          {fromSaved ? "O teu feed" : `${SOURCE_COUNT} órgãos de comunicação`} · {filtered ? label : "todos os partidos"}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {party ? (
            <>
              Notícias {ofParty(partyName!)} <span className={MARKER}>{partyName}</span>
            </>
          ) : filtered ? (
            <>
              {fromSaved ? "As tuas" : "Notícias"} <span className={MARKER}>{fromSaved ? "notícias" : "escolhidas"}</span>
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
            : filtered
              ? "Só os partidos e os jornais que escolheste, por ordem de publicação. Muda a escolha nos filtros abaixo."
              : "Tudo o que se publica sobre os partidos portugueses, num só lugar e por ordem de publicação. Lê, compara e comenta."}
        </p>
      </header>

      <FeedFilters
        key={fromSaved ? "guardado" : "endereco"}
        parties={parties}
        sources={sources.map((item) => ({ domain: item.domain, name: sourceName(item.domain) }))}
        filter={chosen}
        saved={saved}
        q={q}
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <NewsSearch key={q} q={q} filter={chosen} />
          <p className="mb-4 font-mono text-xs text-muted" aria-live="polite">
            {q ? `Notícias com «${q}»` : filtered ? "Notícias" : "Todas as notícias"}
            {filtered && ` · ${label}`}, mais recentes primeiro
          </p>
          {/* On smaller screens the blog's box comes before the news, and the rest of the column is left out. */}
          {spotlight && (
            <div className="mb-6 xl:hidden">
              <BlogSpotlight post={spotlight} />
            </div>
          )}
          <Feed
            key={`${chosen.parties.join(",")}|${q}|${chosen.sources.join(",")}`}
            initialPage={page}
            partySlug={chosen.parties}
            q={q}
            source={chosen.sources}
          />
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

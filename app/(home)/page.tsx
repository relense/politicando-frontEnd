import { FEED_VIEW_COOKIE, parseFeedView } from "@/lib/feedViewCookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { loadHighlights } from "@/components/Highlights";
import { NextEvent } from "@/components/NextEvent";
import { BlogRow, EventRow } from "@/components/FeedInserts";
import { getNextEvent } from "@/lib/api/agenda";
import { FollowCard, SidebarFooter } from "@/components/FollowUs";
import { BlogSpotlight, loadNewsSidebar, MostCommented, PowerNow } from "@/components/NewsSidebar";
import { ScrollableSide } from "@/components/ScrollableSide";
import { FeedFilters } from "@/components/FeedFilters";
import { cached, FEED_PAGE_SIZE, getParties, getSources } from "@/lib/api/client";
import { loadFeed } from "@/lib/api/feed";
import { getToday } from "@/lib/api/stories";
import { FEATURES } from "@/lib/features";
import { TodayInFive } from "@/components/TodayInFive";
import { PodcastBox } from "@/components/PodcastBox";
import { getPodcast } from "@/lib/podcast";
import { getLatestEpisode } from "@/lib/api/podcast";
import { tidyName } from "@/lib/elections";
import { FEED_COOKIE, isEmpty, orderKey, orderOf, orderPhrase, parseFilter, readSavedFilter } from "@/lib/feedFilter";
import { ofParty, partyPath } from "@/lib/parties";
import { SOURCE_COUNT, sourceName } from "@/lib/sources";
import { PredictionsCard } from "@/components/Predictions";
import { getOpenPredictions } from "@/lib/api/engagement";
import { EmailPrompt } from "@/components/account/AccountEmail";

type Props = {
  searchParams: Promise<{
    partido?: string | string[];
    q?: string | string[];
    fonte?: string | string[];
    tudo?: string | string[];
    ordem?: string | string[];
    periodo?: string | string[];
  }>;
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
    : // One address for the home page, however it's reached (politicando.pt, www., ?ordem=…).
      { alternates: { canonical: "/" } };
}

/** The highlighter stroke under a word of the title. */
const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

/** The time of this request, for "Hoje" and "Amanhã". */
const requestTime = () => Date.now();

export default async function HomePage({ searchParams }: Props) {
  await connection();
  const [params, parties, sources, jar] = await Promise.all([
    searchParams,
    getParties().catch(() => []),
    getSources().catch(() => []),
    cookies(),
  ]);
  const { q } = searchOf(params);
  const order = orderOf(params);
  const saved = readSavedFilter(jar.get(FEED_COOKIE)?.value);
  const view = parseFeedView(jar.get(FEED_VIEW_COOKIE)?.value);
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
  // The day's blocks, side by side ("Hoje", backend docs/engagement-api.md): each is cached on its own.
  const [page, highlights, sidebar, nextEvent, episode, allToday, predictions] = await Promise.all([
    loadFeed({ party: chosen.parties, q, source: chosen.sources, limit: FEED_PAGE_SIZE }, order),
    loadHighlights(),
    loadNewsSidebar(),
    getNextEvent(),
    getLatestEpisode(),
    FEATURES.stories ? getToday() : Promise.resolve([]),
    // Anonymous, so cacheable: the reader's own picks come in the browser.
    getOpenPredictions(3, cached).catch(() => []),
  ]);
  // "Hoje em 5" needs a few stories to mean anything: with fewer than 3 in the last 24 hours, no box.
  const today = allToday.length >= 3 ? allToday : [];
  // The blog has one box beside the news, so it never pushes the news down.
  const spotlight = highlights[0] ?? null;
  const podcast = getPodcast();

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
        sources={sources.map((item) => ({ domain: item.domain, name: sourceName(item.domain), count: item.count }))}
        filter={chosen}
        saved={saved}
        q={q}
        order={order}
        view={view}
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {/* What the feed shows, when it isn't the default (the chosen tab already says "Recentes"). */}
          {(q || filtered || order.sort !== "recentes") && (
            <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-widest text-muted" aria-live="polite">
              {q ? `Com «${q}»` : filtered ? "Escolhidas" : "Todas"}
              {filtered && ` · ${label}`}
              {orderPhrase(order)}
            </p>
          )}
          <Feed
            key={`${chosen.parties.join(",")}|${q}|${chosen.sources.join(",")}|${orderKey(order)}`}
            initialView={view}
            initialPage={page}
            partySlug={chosen.parties}
            q={q}
            source={chosen.sources}
            order={order}
            // On smaller screens, without the column beside the news, its two boxes come between the news.
            inserts={[
              ...(today.length > 0 ? [{ after: 3, node: <TodayInFive stories={today} headingId="hoje-em-5-feed" /> }] : []),
              ...(spotlight ? [{ after: 5, node: <BlogRow post={spotlight} /> }] : []),
              ...(predictions.length > 0
                ? [{ after: 6, node: <PredictionsCard initial={predictions} headingId="passa-ou-chumba-feed" /> }]
                : []),
              // Rarely: deep in the feed, at most once a week, gone for good once dismissed.
              // Accounts without a confirmed email, once in a while (the API decides when: askForEmail).
              { after: 8, node: <EmailPrompt />, everywhere: true },
              { after: 24, node: <FollowCard />, everywhere: true },
              ...(podcast
                ? [{ after: 10, node: <PodcastBox podcast={podcast} episode={episode} headingId="podcast-feed" className="my-2" /> }]
                : []),
              ...(nextEvent ? [{ after: 12, node: <EventRow item={nextEvent} now={requestTime()} /> }] : []),
            ]}
          />
        </div>
        <aside aria-label="Ao lado das notícias" className="hidden xl:block">
          <ScrollableSide className="no-scrollbar sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain pb-2">
            {podcast && <PodcastBox podcast={podcast} episode={episode} />}
            {today.length > 0 && <TodayInFive stories={today} />}
            {predictions.length > 0 && <PredictionsCard initial={predictions} />}
            {spotlight && <BlogSpotlight post={spotlight} />}
            {nextEvent && <NextEvent item={nextEvent} now={requestTime()} />}
            <PowerNow data={sidebar.power} />
            <MostCommented articles={sidebar.mostCommented} />
            <SidebarFooter />
          </ScrollableSide>
        </aside>
      </div>
    </div>
  );
}

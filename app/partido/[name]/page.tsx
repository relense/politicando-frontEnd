import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { DeputyPortrait } from "@/components/DeputyProfile";
import { Feed } from "@/components/Feed";
import { PartyHemicycle } from "@/components/PartyHemicycle";
import { PartyInitiatives } from "@/components/PartyInitiatives";
import { PartyLogo } from "@/components/PartyLogo";
import { PartyChipBar } from "@/components/PartyNav";
import { PartyProfile } from "@/components/PartyProfile";
import { PartyVotes } from "@/components/PartyVotes";
import { getElections, getFeedPage, getInitiatives, getParliament, getParties, getPartyStandings } from "@/lib/api/client";
import { formatNumber, formatPercent } from "@/lib/format";
import { partyLeaders } from "@/lib/parliament";
import { findPartyByParam, partyPath } from "@/lib/parties";
import { getPartyProfile } from "@/lib/partyProfiles";
import type { DeputySummary, Election, Parliament, Party, PartyStanding } from "@/lib/types";

type Props = { params: Promise<{ name: string }>; searchParams: Promise<{ ver?: string | string[] }> };

const TABS = [
  { value: "noticias", label: "Notícias" },
  { value: "deputados", label: "Deputados" },
  { value: "iniciativas", label: "Iniciativas" },
  { value: "votacoes", label: "Votações" },
] as const;
type Tab = (typeof TABS)[number]["value"];

async function resolveParty(param: string) {
  const parties = await getParties();
  return { parties, party: findPartyByParam(parties, param) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { party } = await resolveParty((await params).name);
  if (!party) return { title: "Partido não encontrado" };
  const title = `${party.acronym}: ${party.name}`;
  return {
    title,
    description: getPartyProfile(party.slug)?.summary ?? `As últimas notícias sobre ${party.name}.`,
    alternates: { canonical: partyPath(party.slug) },
    openGraph: { title, url: partyPath(party.slug) },
  };
}

const tabPath = (slug: string, tab: Tab) => (tab === "noticias" ? partyPath(slug) : `${partyPath(slug)}?ver=${tab}`);

export default async function PartyPage({ params, searchParams }: Props) {
  await connection();
  const [{ name }, { ver }] = await Promise.all([params, searchParams]);
  const { parties, party } = await resolveParty(name);
  if (!party) notFound();
  // Old links such as /partido/l keep working and move to the current address.
  if (name !== party.slug) permanentRedirect(partyPath(party.slug));

  const [parliament, standings, legislativas] = await Promise.all([
    // The party page works without Parliament or election data; those parts just aren't shown.
    getParliament().catch(() => null),
    getPartyStandings(),
    getElections("legislativas").catch((): Election[] => []),
  ]);
  const seats = parliament?.groups.find((group) => group.party.slug === party.slug)?.seats ?? 0;
  // Tabs about Parliament only exist for parties with deputies.
  const tabs = seats > 0 ? TABS : TABS.filter((tab) => tab.value === "noticias");
  const tab: Tab = tabs.find((item) => item.value === ver)?.value ?? "noticias";

  const deputies = parliament ? sortDeputies(parliament.deputies, party.slug) : [];
  const { leader, benchLeader } = partyLeaders(deputies, party.slug);
  // The Parliament records votes by group: any of the party's deputies gives its votes.
  const voter = leader?.deputy ?? benchLeader ?? deputies[0] ?? null;

  const [page, initiatives] = await Promise.all([
    tab === "noticias" ? getFeedPage({ party: party.slug }) : null,
    seats > 0 && (tab === "noticias" || tab === "iniciativas") ? getInitiatives({ party: party.slug }).catch(() => null) : null,
  ]);

  const profile = getPartyProfile(party.slug);
  const election = legislativas.find((item) => item.imported) ?? null;
  const standing = standings[party.slug];
  // A card for the numbers only when there is more than the founding year, which otherwise goes under the summary.
  const hasFactsCard = seats > 0 || Boolean(election && standing && standing.votes > 0);

  return (
    <div data-wide className="@container">
      <PartyChipBar parties={parties} always />
      <header className="grid items-start gap-8 @4xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <div className="flex items-center gap-5">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-line sm:size-24">
              <PartyLogo slug={party.slug} acronym={party.acronym} size={72} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                <span className="font-bold text-ink">{party.acronym}</span> ·{" "}
                {seats > 0 ? "com assento parlamentar" : "sem assento parlamentar"}
              </p>
              <h1 className={`mt-1 font-bold leading-tight ${party.name.length > 22 ? "text-2xl sm:text-4xl" : "text-3xl sm:text-5xl"}`}>
                {party.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {party.website && (
                  <a href={party.website} target="_blank" rel="noopener noreferrer" className={pill}>
                    Site oficial <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (abre num novo separador)</span>
                  </a>
                )}
                {seats > 0 && (
                  <Link href={tabPath(party.slug, "deputados")} className={pill}>
                    Ver {seats === 1 ? "o deputado" : `os ${seats} deputados`} <span aria-hidden="true">→</span>
                  </Link>
                )}
                <Link href={`/forum/${party.slug}`} className={pill}>
                  Fórum do {party.acronym} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
          {profile && <PartyProfile profile={profile} withFounded={!hasFactsCard} />}
        </div>
        {hasFactsCard && (
          <FactsCard
            party={party}
            parliament={seats > 0 ? parliament : null}
            seats={seats}
            standing={standing}
            election={election}
            founded={profile?.founded ?? null}
            leader={leader}
          />
        )}
      </header>

      {tabs.length > 1 && (
        <nav aria-label={`Secções do ${party.acronym}`} className="mt-10 border-b border-line">
          <ul className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]">
            {tabs.map((item) => (
              <li key={item.value} className="shrink-0">
                <Link
                  href={tabPath(party.slug, item.value)}
                  aria-current={tab === item.value ? "page" : undefined}
                  scroll={false}
                  className={`flex items-center gap-2 border-b-2 py-3 font-mono text-sm font-bold ${
                    tab === item.value ? "border-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                  {item.value === "deputados" && (
                    <span className="rounded-full bg-surface px-1.5 font-normal text-xs text-muted">{seats}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className={tabs.length > 1 ? "mt-8" : "mt-10"}>
        {tab === "noticias" && page && (
          <div className="grid items-start gap-8 @4xl:grid-cols-[minmax(0,1fr)_17rem]">
            <section aria-label={`Notícias sobre o ${party.acronym}`} className="min-w-0">
              <Feed key={party.slug} partySlug={party.slug} initialPage={page} />
            </section>
            {seats > 0 && (
              <aside aria-label={`Resumo do ${party.acronym} no Parlamento`} className="hidden flex-col gap-5 @4xl:flex">
                <SidePanel title="Deputados" more={{ href: tabPath(party.slug, "deputados"), label: `Ver os ${seats}` }}>
                  <Faces deputies={deputies} />
                </SidePanel>
                {voter && (
                  <SidePanel title="Como votou" more={{ href: tabPath(party.slug, "votacoes"), label: "Todas" }}>
                    <PartyVotes deputyId={voter.id} acronym={party.acronym} compact />
                  </SidePanel>
                )}
                <SidePanel title="Iniciativas" more={{ href: tabPath(party.slug, "iniciativas"), label: "Todas" }}>
                  <PartyInitiatives slug={party.slug} acronym={party.acronym} initialPage={initiatives} compact />
                </SidePanel>
              </aside>
            )}
          </div>
        )}
        {tab === "deputados" && <DeputyGrid deputies={deputies} party={party} />}
        {tab === "iniciativas" && (
          <section aria-label={`Iniciativas do ${party.acronym}`} className="max-w-3xl">
            <PartyInitiatives slug={party.slug} acronym={party.acronym} initialPage={initiatives} />
          </section>
        )}
        {tab === "votacoes" && voter && (
          <section aria-label={`Votações do ${party.acronym}`} className="max-w-3xl">
            <p className="mb-4 text-sm text-muted">
              O Parlamento regista os votos por bancada. Aqui aparecem as votações em que a bancada do {party.acronym} votou toda no mesmo
              sentido.
            </p>
            <PartyVotes deputyId={voter.id} acronym={party.acronym} />
          </section>
        )}
      </div>
    </div>
  );
}

const pill = "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface";

/** The leader first, then the bench leader, then by name. */
function sortDeputies(deputies: readonly DeputySummary[], slug: string): DeputySummary[] {
  const { leader, benchLeader } = partyLeaders(deputies, slug);
  const rank = (deputy: DeputySummary) => (deputy === leader?.deputy ? 0 : deputy === benchLeader ? 1 : 2);
  return deputies
    .filter((deputy) => deputy.partySlug === slug)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "pt", { sensitivity: "base" }));
}

/** "Presidente do CHEGA" → "Presidente". */
const leaderLabel = (title: string) => title.replace(/\s+d[oa]s?\s.*$/, "");

function FactsCard({
  party,
  parliament,
  seats,
  standing,
  election,
  founded,
  leader,
}: {
  party: Party;
  parliament: Parliament | null;
  seats: number;
  standing: PartyStanding | undefined;
  election: Election | null;
  founded: number | null;
  leader: ReturnType<typeof partyLeaders<DeputySummary>>["leader"];
}) {
  const voted = election && standing && standing.votes > 0;
  const facts: { label: string; value: ReactNode }[] = [];
  if (voted) {
    facts.push({
      label: election.name,
      value: (
        <>
          {formatPercent(standing.validPct)}
          {standing.coalition && <span className="block font-normal text-xs text-muted">em coligação</span>}
        </>
      ),
    });
  }
  if (founded) facts.push({ label: "Fundado em", value: founded });
  if (leader) {
    facts.push({
      label: leaderLabel(leader.title),
      value: (
        <Link href={`/deputados/${leader.deputy.id}`} className="hover:underline">
          {leader.deputy.name}
        </Link>
      ),
    });
  }
  if (voted) facts.push({ label: "Votos", value: formatNumber(standing.votes) });
  if (!parliament && facts.length === 0) return null;

  const total = parliament?.seatMap.seats.length ?? 230;
  const list = facts.length > 0 && (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {facts.map((fact) => (
        <div key={fact.label} className="flex min-w-0 flex-col-reverse">
          <dd className="font-mono text-sm font-bold">{fact.value}</dd>
          <dt className="font-mono text-xs text-muted">{fact.label}</dt>
        </div>
      ))}
    </dl>
  );
  return (
    <section
      aria-label={parliament ? `${party.acronym} no Parlamento` : `${party.acronym} em números`}
      className="@container/card rounded-2xl border border-line bg-surface/40 p-5"
    >
      {parliament ? (
        <>
          <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
            <h2 className="font-bold uppercase tracking-widest">No Parlamento</h2>
            <span className="text-muted">{parliament.legislature} Legislatura</span>
          </div>
          {/* Narrow (beside the text): one column. Wide (below it, on smaller screens): the chamber beside the numbers. */}
          <div className="grid gap-4 @lg/card:grid-cols-[minmax(0,18rem)_1fr] @lg/card:items-center @lg/card:gap-8">
            <div>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-5xl font-bold leading-none">{seats}</span>
                <span className="whitespace-nowrap font-mono text-sm text-muted">
                  de {total} lugares · {Math.round((seats / total) * 100)}%
                </span>
              </p>
              <div className="mt-4">
                <PartyHemicycle seatMap={parliament.seatMap} slug={party.slug} />
              </div>
            </div>
            {list && <div className="border-t border-line pt-4 @lg/card:border-0 @lg/card:pt-0">{list}</div>}
          </div>
        </>
      ) : (
        list
      )}
    </section>
  );
}

function SidePanel({ title, more, children }: { title: string; more: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest">{title}</h2>
        <Link href={more.href} scroll={false} className="shrink-0 whitespace-nowrap font-mono text-xs text-link underline">
          {more.label} <span aria-hidden="true">→</span>
        </Link>
      </div>
      {children}
    </section>
  );
}

/** The first few faces, overlapping, and how many more there are. */
function Faces({ deputies }: { deputies: DeputySummary[] }) {
  const shown = deputies.slice(0, 6);
  const rest = deputies.length - shown.length;
  return (
    <>
      <ul className="flex -space-x-1.5">
        {shown.map((deputy) => (
          <li key={deputy.id}>
            <Link href={`/deputados/${deputy.id}`} title={deputy.name} className="block rounded-full">
              <DeputyPortrait deputy={deputy} size="xs" />
              <span className="sr-only">{deputy.name}</span>
            </Link>
          </li>
        ))}
        {rest > 0 && (
          <li className="flex size-9 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold text-paper">
            +{rest}
          </li>
        )}
      </ul>
    </>
  );
}

/** A post short enough for a card ("Líder do grupo parlamentar"), not a committee's full name. */
const shortPost = (deputy: DeputySummary) => deputy.role ?? deputy.positions.find((position) => position.length <= 50) ?? null;

function DeputyGrid({ deputies, party }: { deputies: DeputySummary[]; party: Party }) {
  return (
    <section aria-label={`Deputados do ${party.acronym}`}>
      <ul className="grid gap-3 sm:grid-cols-2 @4xl:grid-cols-3">
        {deputies.map((deputy) => (
          <li key={deputy.id}>
            <Link
              href={`/deputados/${deputy.id}`}
              className="flex h-full items-center gap-4 rounded-2xl border border-line p-4 hover:bg-surface"
            >
              <DeputyPortrait deputy={deputy} size="sm" />
              <span className="min-w-0">
                <span className="block font-bold leading-snug">{deputy.name}</span>
                <span className="block font-mono text-xs text-muted">{deputy.constituency}</span>
                {shortPost(deputy) && <span className="block text-xs text-muted">{shortPost(deputy)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 font-mono text-xs">
        <Link href={`/parlamento?partido=${party.slug}`} className="text-link underline">
          Ver a bancada no hemiciclo
        </Link>
      </p>
    </section>
  );
}

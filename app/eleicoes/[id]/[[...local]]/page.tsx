import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { CircleTiles, type CircleTile } from "@/components/CircleTiles";
import { ElectionMap, winnerColor, type MapPlace } from "@/components/ElectionMap";
import { MajoritySimulator } from "@/components/MajoritySimulator";
import { ResultsTable, type ResultRow } from "@/components/ResultsTable";
import { ApiError, getElectionResult, getElections, getParties } from "@/lib/api/client";
import {
  chamberOrder,
  CHILDREN_HEADING,
  compareLists,
  electionPath,
  formatPoints,
  hasMandates,
  listColor,
  listLabel,
  listName,
  mergeSameParties,
  ORGAN_LABELS,
  resultSentence,
  typeLabel,
} from "@/lib/elections";
import { formatLongDate, formatNumber, formatPercent } from "@/lib/format";
import { placeMap } from "@/lib/maps";
import { partyColor } from "@/lib/parliament";
import { partyPath } from "@/lib/parties";
import { PLACE_KEY, placePath } from "@/lib/places";
import type { Election, ElectionList, ElectionResult, Party } from "@/lib/types";

type Props = { params: Promise<{ id: string; local?: string[] }>; searchParams: Promise<{ orgao?: string | string[] }> };

const ID = /^[a-z]+-\d{4}$/;
const PLACE = /^(GLOBAL|LOCAL|FOREIGN)-\d{6}$/;

/** One request per render, shared by the metadata and the page. Null for an unknown election, place or body. */
const loadResult = cache(async (id: string, place: string | undefined, organ: string | undefined): Promise<ElectionResult | null> => {
  if (!ID.test(id) || (place && !PLACE.test(place)) || (organ && !/^[A-Z]{2,3}$/.test(organ))) return null;
  try {
    return await getElectionResult(id, { place, organ });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

async function resolve({ params, searchParams }: Props) {
  const [{ id, local }, { orgao }] = await Promise.all([params, searchParams]);
  // Only one place segment exists; anything deeper is not a page.
  if (local && local.length > 1) return null;
  return loadResult(id, local?.[0], typeof orgao === "string" ? orgao : undefined);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const result = await resolve(props);
  if (!result) return { title: "Eleição não encontrada" };
  const where = result.place.level === "global" ? "" : ` em ${result.place.name}`;
  return {
    title: `${result.election.name}${where}`,
    description: `Resultados das ${result.election.name}${where}: votos, percentagens e mandatos de cada lista, e a participação.`,
    alternates: { canonical: electionPath(result.election.id, result.place.level === "global" ? null : result.place.key) },
  };
}

/** How deep each level is, to compare a place's level with the deepest one an election has results for. */
const LEVEL_DEPTH: Record<string, number> = { global: 0, national: 0, foreign: 0, country: 0, district: 1, municipality: 2, parish: 3 };

export default async function ElectionPage(props: Props) {
  await connection();
  const [result, parties] = await Promise.all([resolve(props), getParties().catch((): Party[] => [])]);
  if (!result) notFound();

  const { election, organ, place, breadcrumb, turnout, lists, children: inside } = result;
  const mainOrgan = election.organs[0];
  // The main body stays out of the address.
  const organParam = organ === mainOrgan ? null : organ;
  const organQuery = organParam ?? undefined;
  const seats = hasMandates(organ) && turnout?.totalMandates ? turnout.totalMandates : null;
  const isTop = place.level === "global";
  const placeKey = isTop ? null : place.key;

  // Previous and next election of the same type, for the same place.
  const sameType = await getElections(election.type).catch((): Election[] => []);
  const timeline = sameType.filter((item) => item.imported).sort((a, b) => a.date.localeCompare(b.date));
  const at = timeline.findIndex((item) => item.id === election.id);
  // Places only down to the level this election has results for: no map or list of places with nothing in them.
  const deepest = sameType.find((item) => item.id === election.id)?.deepestLevel ?? null;
  const children = inside.length > 0 && deepest && (LEVEL_DEPTH[inside[0]!.level] ?? 0) > (LEVEL_DEPTH[deepest] ?? 9) ? [] : inside;
  const previous = at > 0 ? timeline[at - 1] : undefined;
  const next = at >= 0 ? timeline[at + 1] : undefined;
  // The same place and body in the previous election, to show what changed; nothing when either is missing there.
  const previousResult =
    previous && (organ === mainOrgan || previous.organs.includes(organ))
      ? await loadResult(previous.id, placeKey ?? undefined, organ === mainOrgan ? undefined : organ).catch(() => null)
      : null;
  const changes = previousResult && previousResult.lists.length > 0 ? compareLists(lists, previousResult.lists) : null;
  const turnoutChange =
    previousResult?.turnout?.turnoutPct != null && turnout?.turnoutPct != null
      ? Math.round((turnout.turnoutPct - previousResult.turnout.turnoutPct) * 10) / 10
      : null;

  // At the top, the circles: the mainland's districts and the two circles abroad, each with its own result.
  const national = isTop ? children.find((child) => child.level === "national") : undefined;
  const foreign = isTop ? children.find((child) => child.level === "foreign") : undefined;
  const [nationalResult, foreignResult] = await Promise.all([
    national ? loadResult(election.id, national.key, organQuery) : null,
    foreign ? loadResult(election.id, foreign.key, organQuery) : null,
  ]);
  const circlePlaces = [...(nationalResult?.children ?? []), ...(foreignResult?.children ?? [])];
  const circleResults = await Promise.all(circlePlaces.map((child) => loadResult(election.id, child.key, organQuery).catch(() => null)));
  const tiles: CircleTile[] = circlePlaces.map((child, index) => {
    const detail = circleResults[index];
    const code = child.level === "foreign" ? (/Fora/i.test(child.name) ? "FEU" : "EUR") : (child.dicofre ?? child.key);
    return {
      code,
      name: child.name,
      href: electionPath(election.id, child.key, organParam),
      mandates: hasMandates(organ) ? (detail?.turnout?.totalMandates ?? null) : null,
      color: child.winner ? winnerColor(child.winner.partySlugs) : null,
      winner: child.winner ? winnerName(child.winner, parties) : null,
      top: (detail?.lists ?? []).slice(0, 3).map((item) => ({
        label: listLabel(item, parties),
        color: listColor(item),
        pct: formatPercent(item.validPct),
        share: item.validPct ?? 0,
        mandates: hasMandates(organ) ? item.mandates : null,
      })),
    };
  });

  // Below the top, the places inside this one, on the official map and in a list.
  const map =
    !isTop && children.length > 0
      ? placeMap(
          children[0]!.level,
          children.map((child) => child.dicofre),
        )
      : null;
  const mapPlaces: MapPlace[] = children.flatMap((child) =>
    child.dicofre
      ? [
          {
            code: child.dicofre,
            name: child.name,
            href: electionPath(election.id, child.key, organParam),
            color: child.winner ? winnerColor(child.winner.partySlugs) : null,
            winner: child.winner ? winnerName(child.winner, parties) : null,
            pct: child.winner?.validPct ?? null,
          },
        ]
      : [],
  );

  const rows: ResultRow[] = lists.map((item) => ({
    key: `${item.list}-${item.name}`,
    name: listName(item, parties),
    color: listColor(item),
    parties: item.partySlugs.flatMap((slug) => {
      const party = parties.find((candidate) => candidate.slug === slug);
      return party ? [{ slug, acronym: party.acronym, href: partyPath(slug) }] : [];
    }),
    citizens: item.citizens,
    mandates: item.mandates,
    pct: formatPercent(item.validPct),
    share: item.validPct ?? 0,
    votes: formatNumber(item.votes),
    change: (() => {
      const change = changes?.get(item)?.change;
      if (change === null || change === undefined) return null;
      return { label: formatPoints(change), direction: change > 0 ? "up" : change < 0 ? "down" : "same" } as const;
    })(),
  }));
  const merged = mergeSameParties(lists);
  const chamber = seats && seats >= 10 ? chamberOrder(merged) : [];
  const winnerKey = (item: ElectionList) => `${item.list}-${item.name}`;
  const sentence = resultSentence(lists, parties, seats, formatPercent);
  const share = (part: number | null) => (part !== null && turnout?.voters ? formatPercent((part / turnout.voters) * 100) : null);

  return (
    <div data-wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Caminho" className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted">
          <Link href="/eleicoes" className="underline hover:text-ink">
            Eleições
          </Link>
          <span aria-hidden="true">›</span>
          <Link href={`/eleicoes#tipo-${election.type}`} className="hover:text-ink hover:underline">
            {typeLabel(election.type)}
          </Link>
          <span aria-hidden="true">›</span>
          <Link
            href={electionPath(election.id, null, organParam)}
            className="hover:text-ink hover:underline"
            aria-current={isTop ? "page" : undefined}
          >
            {election.date.slice(0, 4)}
          </Link>
          {breadcrumb
            .filter((item) => item.level !== "global")
            .map((item) => (
              <span key={item.key} className="contents">
                <span aria-hidden="true">›</span>
                <Link href={electionPath(election.id, item.key, organParam)} className="hover:text-ink hover:underline">
                  {item.name}
                </Link>
              </span>
            ))}
        </nav>
        {(previous || next) && (
          <nav aria-label={`Outras ${typeLabel(election.type).toLowerCase()}`} className="flex gap-2 font-mono text-xs font-bold">
            {previous ? (
              <Link href={electionPath(previous.id, placeKey, null)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface">
                <span aria-hidden="true">←</span> {previous.date.slice(0, 4)}
              </Link>
            ) : null}
            {next ? (
              <Link href={electionPath(next.id, placeKey, null)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface">
                {next.date.slice(0, 4)} <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </nav>
        )}
      </div>

      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          {typeLabel(election.type)} · {formatLongDate(election.date)}
          {!isTop && <> · {election.name}</>}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{isTop ? election.name : place.name}</h1>
        {sentence && <p className="mt-2 max-w-2xl leading-relaxed text-muted">{sentence}</p>}
        {PLACE_KEY.test(place.key) && ["district", "municipality", "parish"].includes(place.level) && (
          <Link href={placePath(place.key)} className="mt-3 inline-block font-mono text-sm text-link underline">
            Quem governa {place.name} →
          </Link>
        )}
      </header>

      {election.organs.length > 1 && (
        <nav aria-label="Órgão" className="mb-6 flex flex-wrap gap-2">
          {election.organs.map((code) => (
            <Link
              key={code}
              href={electionPath(election.id, placeKey, code === mainOrgan ? null : code)}
              aria-current={code === organ ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs font-bold ${
                code === organ ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
              }`}
            >
              {ORGAN_LABELS[code] ?? code}
            </Link>
          ))}
        </nav>
      )}

      {turnout && (
        <dl className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Fact label="Participação" value={formatPercent(turnout.turnoutPct)}>
            {turnout.turnoutPct !== null && (
              <>
                <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full bg-ink" style={{ width: `${turnout.turnoutPct}%` }} />
                </span>
                <span className="mt-1.5 block">Abstenção {formatPercent(100 - turnout.turnoutPct)}</span>
                {turnoutChange !== null && previousResult && (
                  <span className="block">
                    {formatPoints(turnoutChange)} vs {previousResult.election.date.slice(0, 4)}
                  </span>
                )}
              </>
            )}
          </Fact>
          <Fact label="Votantes" value={turnout.voters !== null ? formatNumber(turnout.voters) : null}>
            {turnout.registered !== null && <>de {formatNumber(turnout.registered)} inscritos</>}
          </Fact>
          <Fact label="Votos em branco" value={turnout.blank !== null ? formatNumber(turnout.blank) : null}>
            {share(turnout.blank) && <>{share(turnout.blank)} dos votantes</>}
          </Fact>
          <Fact label="Votos nulos" value={turnout.null !== null ? formatNumber(turnout.null) : null}>
            {share(turnout.null) && <>{share(turnout.null)} dos votantes</>}
          </Fact>
        </dl>
      )}

      {chamber.length > 0 && seats && (
        <Section id="parlamento" title={isTop && organ === "AR" ? "O novo Parlamento" : "Mandatos"}>
          <MajoritySimulator
            total={seats}
            initial={merged[0] && (merged[0].mandates ?? 0) > 0 ? [winnerKey(merged[0])] : []}
            lists={chamber.map((item) => ({
              key: winnerKey(item),
              label: listLabel(item, parties),
              name: listName(item, parties),
              color: listColor(item),
              seats: item.mandates ?? 0,
            }))}
          />
        </Section>
      )}

      <Section id="resultados" title="Resultados por lista" note={ORGAN_LABELS[organ] ?? organ}>
        <ResultsTable rows={rows} withMandates={Boolean(seats)} compareTo={changes && previous ? previous.date.slice(0, 4) : undefined} />
        {changes && previous && (
          <p className="mt-2 font-mono text-[11px] text-muted">
            Eleição anterior:{" "}
            <Link href={electionPath(previous.id, placeKey, organParam)} className="underline hover:text-ink">
              {previous.name}
            </Link>
            . Diferença em pontos percentuais; sem comparação quando a lista não concorreu da mesma forma (por exemplo, uma coligação que
            antes concorria em listas separadas).
          </p>
        )}
      </Section>

      {isTop && (national || foreign) && (
        <Section id="locais" title={tiles.some((tile) => tile.mandates) ? "Por círculo eleitoral" : "Por região"}>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {[national, foreign].map((child) =>
              child ? (
                <Link
                  key={child.key}
                  href={electionPath(election.id, child.key, organParam)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4 hover:bg-surface"
                >
                  <span>
                    <span className="block font-mono text-xs font-bold uppercase tracking-widest text-muted">{child.name}</span>
                    {child.winner && (
                      <span className="mt-1 flex items-center gap-1.5 font-mono text-sm font-bold">
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-sm"
                          style={{ backgroundColor: winnerColor(child.winner.partySlugs) ?? "var(--muted)" }}
                        />
                        {winnerName(child.winner, parties)} <span className="font-normal">{formatPercent(child.winner.validPct)}</span>
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-muted">venceu</span>
                </Link>
              ) : null,
            )}
          </div>
          {tiles.length > 0 && <CircleTiles circles={tiles} initial={tiles.some((tile) => tile.code === "11") ? "11" : tiles[0]!.code} />}
        </Section>
      )}

      {!isTop && children.length > 0 && (
        <Section id="locais" title={CHILDREN_HEADING[children[0]!.level]}>
          <div className={map ? "grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}>
            {map && (
              <ElectionMap
                map={map}
                places={mapPlaces}
                label={`Mapa ${CHILDREN_HEADING[children[0]!.level]!.toLowerCase()}, pela lista mais votada`}
              />
            )}
            <ul className="divide-y divide-line">
              {children.map((child) => (
                <li key={child.key}>
                  <Link
                    href={electionPath(election.id, child.key, organParam)}
                    className="-mx-2 flex items-center gap-3 rounded px-2 py-2 hover:bg-surface"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: child.winner?.partySlugs[0] ? partyColor(child.winner.partySlugs[0]) : "var(--muted)" }}
                    />
                    <span className="min-w-0 flex-1 truncate font-bold">{child.name}</span>
                    {child.winner && (
                      <span className="shrink-0 font-mono text-xs text-muted">
                        <span className="sr-only">Mais votado: </span>
                        {winnerName(child.winner, parties)} {formatPercent(child.winner.validPct)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fonte: Ministério da Administração Interna
        {election.sourceUrl && (
          <>
            {" "}
            (
            <a href={election.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
              resultados oficiais
            </a>
            )
          </>
        )}
        {map && <>. Limites: {map.source}</>}.
      </p>
    </div>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-12">
      <h2 id={id} className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
        {title}
        {note && <span className="font-normal normal-case tracking-normal text-muted"> · {note}</span>}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, value, children }: { label: string; value: string | null; children?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-line p-4">
      <dt className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold sm:text-3xl">{value}</dd>
      {children && <dd className="mt-1 font-mono text-[11px] text-muted">{children}</dd>}
    </div>
  );
}

/** A winner's short name: our party's acronym when it is one of ours, the ballot's otherwise. */
function winnerName(winner: { list: string; partySlugs: string[] }, parties: Party[]): string {
  const acronyms = winner.partySlugs.map((slug) => parties.find((party) => party.slug === slug)?.acronym).filter(Boolean);
  return acronyms.length > 0 ? acronyms.join("/") : winner.list;
}

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Chamber } from "@/components/Chamber";
import { ApiError, getElectionResult, getElectionsMenu, getParties } from "@/lib/api/client";
import {
  chamberOrder,
  ELECTION_TYPES,
  electionPath,
  listColor,
  listLabel,
  listName,
  majorityNote,
  mergeSameParties,
} from "@/lib/elections";
import { formatLongDate, formatPercent } from "@/lib/format";
import { majority } from "@/lib/parliament";
import type { Election, ElectionResult, Party, UpcomingElection } from "@/lib/types";

export const metadata: Metadata = {
  title: "Eleições",
  description: "Os resultados das eleições em Portugal: legislativas, autárquicas, presidenciais e europeias, do país à freguesia.",
  alternates: { canonical: "/eleicoes" },
};

/** Null while the API does not serve elections yet, so the page can say so calmly. */
async function loadElections(): Promise<{ elections: Election[]; upcoming: UpcomingElection[] } | null> {
  try {
    return await getElectionsMenu();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

const newestFirst = (a: Election, b: Election) => b.date.localeCompare(a.date);
/** The latest of each type get a card; the older ones a line each, by decade. */
const CARDS = 6;

export default async function ElectionsPage() {
  await connection();
  const [menu, parties] = await Promise.all([loadElections(), getParties().catch((): Party[] => [])]);
  const sorted = [...(menu?.elections ?? [])].sort(newestFirst);
  const today = new Date().toISOString().slice(0, 10);
  // The API's coming elections, plus any election in the list already dated after today (a decree has set it).
  const scheduled: UpcomingElection[] = sorted
    .filter((election) => election.date > today && !(menu?.upcoming ?? []).some((item) => item.type === election.type))
    .map((election) => ({
      type: election.type,
      name: election.name,
      year: Number(election.date.slice(0, 4)),
      date: election.date,
      confirmed: true,
      window: null,
      basis: null,
    }));
  const upcoming = [...scheduled, ...(menu?.upcoming ?? [])].sort((a, b) =>
    (a.date ?? `${a.year ?? 9999}-12-31`).localeCompare(b.date ?? `${b.year ?? 9999}-12-31`),
  );
  // The newest legislativas up front, as they decide the Government; else the newest election whose results load.
  let latest: Election | null = null;
  let latestResult: ElectionResult | null = null;
  const imported = sorted.filter((item) => item.imported);
  const candidates = [...imported.filter((item) => item.type === "legislativas").slice(0, 1), ...imported.slice(0, 3)];
  for (const election of candidates) {
    latestResult = await getElectionResult(election.id).catch(() => null);
    if (latestResult) {
      latest = election;
      break;
    }
  }
  const types = ELECTION_TYPES.map((item) => {
    const ofType = sorted.filter((election) => election.type === item.type);
    return { ...item, elections: ofType.filter((election) => election.date <= today) };
  }).filter((item) => item.elections.length > 0);
  const since = sorted
    .filter((election) => election.date <= today)
    .at(-1)
    ?.date.slice(0, 4);

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Resultados oficiais</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Eleições</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Quem ganhou, com quantos votos e onde{since ? `, desde ${since}` : ""}. Escolhe uma eleição e desce do país ao distrito, ao
          concelho e à freguesia, até onde houver resultados.
        </p>
      </header>

      {types.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Os resultados estarão disponíveis em breve.
        </p>
      ) : (
        <>
          <nav aria-label="Tipos de eleição" className="mb-8 flex flex-wrap gap-2">
            {types.map(({ type, label, elections: ofType }) => (
              <a
                key={type}
                href={`#tipo-${type}`}
                className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
              >
                {label} <span className="rounded-full bg-surface px-1.5 font-normal text-muted">{ofType.length}</span>
              </a>
            ))}
          </nav>

          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="min-w-0">
              {latest && latestResult && (
                <Featured election={latest} result={latestResult} parties={parties} newest={latest.id === imported[0]?.id} />
              )}

              <div className="space-y-14">
                {types.map(({ type, label, about, elections: ofType }) => {
                  // The featured election is not repeated in its type's cards.
                  const cards = ofType.filter((election) => election.id !== latest?.id);
                  return (
                    <section key={type} aria-labelledby={`tipo-${type}`}>
                      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
                        <h2 id={`tipo-${type}`} className="scroll-mt-20 font-mono text-sm font-bold uppercase tracking-widest">
                          {label}
                        </h2>
                        <span className="font-mono text-xs text-muted">
                          {ofType.length} {ofType.length === 1 ? "eleição" : "eleições"}
                        </span>
                      </div>
                      <p className="mb-5 mt-3 max-w-xl text-sm text-muted">{about}</p>
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {cards.slice(0, CARDS).map((election) => (
                          <li key={election.id}>
                            <ElectionCard election={election} parties={parties} />
                          </li>
                        ))}
                      </ul>
                      {cards.length > CARDS && (
                        <OlderElections type={type} label={label} elections={cards.slice(CARDS)} parties={parties} />
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
            <aside
              aria-label="Ao lado dos resultados"
              className="no-scrollbar flex flex-col gap-4 self-start xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:pb-2"
            >
              {upcoming.length > 0 && <Upcoming elections={upcoming} />}
              <Turnout types={types.map(({ type, label, elections: ofType }) => ({ type, label, elections: ofType }))} />
            </aside>
          </div>
        </>
      )}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fonte: Ministério da Administração Interna (eleicoes.mai.gov.pt).
      </p>
    </div>
  );
}

const listKey = (item: { list: string; name: string }) => `${item.list}-${item.name}`;

/** The latest election, up front: its chamber, its seats bar and the top three. */
function Featured({
  election,
  result,
  parties,
  newest,
}: {
  election: Election;
  result: ElectionResult;
  parties: Party[];
  newest: boolean;
}) {
  const total = result.turnout?.totalMandates ?? null;
  const lists = mergeSameParties(result.lists);
  const seated = total && total >= 10 ? chamberOrder(lists) : [];
  const top = lists.slice(0, 3);
  return (
    <section aria-labelledby="mais-recente" className="mb-14 rounded-2xl border border-line p-5 sm:p-6">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
            <span className="rounded-full bg-ink px-2 py-0.5 font-bold text-paper">
              {newest
                ? "Mais recente"
                : `Últimas ${(ELECTION_TYPES.find((item) => item.type === election.type)?.label ?? "eleições").toLowerCase()}`}
            </span>
            {ELECTION_TYPES.find((item) => item.type === election.type)?.label} · {formatLongDate(election.date)}
          </p>
          <h2 id="mais-recente" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            <Link href={electionPath(election.id)} className="hover:underline">
              {election.name}
            </Link>
          </h2>
          {seated.length > 0 && total && (
            <div className="mt-4">
              <div aria-hidden="true" className="relative flex h-3 overflow-hidden rounded-full bg-surface">
                {seated.map((item) => (
                  <span
                    key={listKey(item)}
                    className="h-full border-r border-paper last:border-0"
                    style={{ width: `${((item.mandates ?? 0) / total) * 100}%`, backgroundColor: listColor(item) }}
                  />
                ))}
                <span
                  className="absolute inset-y-0 border-l-2 border-dashed border-ink"
                  style={{ left: `${(majority(total) / total) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-muted">
                {total} mandatos · maioria {majority(total)} (tracejado)
              </p>
            </div>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
            {top.map((item) => (
              <li key={listKey(item)} className="flex items-center gap-1.5" title={listName(item, parties)}>
                <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: listColor(item) }} />
                <span className="font-bold">
                  {listLabel(item, parties)}
                  {item.mandates ? ` ${item.mandates}` : ""}
                </span>
                <span className="text-muted">· {formatPercent(item.validPct)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {seated.length > 0 && total && (
            <Chamber
              total={total}
              groups={seated.map((item) => ({ key: listKey(item), color: listColor(item), seats: item.mandates ?? 0 }))}
            />
          )}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 font-mono text-[11px]">
            <span className="text-muted">
              Participação <span className="font-bold text-ink">{formatPercent(result.turnout?.turnoutPct)}</span>
            </span>
            <Link href={electionPath(election.id)} className="whitespace-nowrap font-bold hover:underline">
              Ver resultados <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Turnout over time for each type, in one box beside the results. */
function Turnout({ types }: { types: { type: string; label: string; elections: Election[] }[] }) {
  const shown = types.filter(
    ({ elections }) => elections.filter((election) => election.imported && election.turnout?.turnoutPct != null).length >= 2,
  );
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="participacao" className="rounded-2xl border border-line p-4">
      <h2 id="participacao" className="font-mono text-xs font-bold uppercase tracking-widest">
        Participação
      </h2>
      <p className="mt-1 text-xs text-muted">Quantos dos inscritos votaram, eleição a eleição.</p>
      <div className="mt-2 divide-y divide-line">
        {shown.map(({ type, label, elections }) => (
          <div key={type} className="py-3">
            <TurnoutBars label={label} elections={elections} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Turnout in each election of a type, oldest to newest, the latest highlighted. */
function TurnoutBars({ label: title, elections }: { label: string; elections: Election[] }) {
  const points = elections
    .filter((election) => election.imported && election.turnout?.turnoutPct != null)
    // Presidenciais can have two rounds in one year: the second says so.
    .map((election) => ({
      id: election.id,
      year: election.date.slice(0, 4),
      second: election.round === 2,
      pct: election.turnout!.turnoutPct!,
    }))
    .reverse();
  if (points.length < 2) return null;
  const label = `${title}, participação: ${points
    .map((point) => `${point.year}${point.second ? " (2.ª volta)" : ""}, ${formatPercent(point.pct)}`)
    .join("; ")}`;
  // Many elections in a narrow box: thin bars without labels, the latest value up top, the extremes written out below.
  const latest = points.at(-1)!;
  const highest = points.reduce((best, point) => (point.pct > best.pct ? point : best));
  const lowest = points.reduce((best, point) => (point.pct < best.pct ? point : best));
  const name = (point: (typeof points)[number]) => `${point.year}${point.second ? " (2.ª v.)" : ""}`;
  // From a little under the lowest value, so the rises and falls show; the exact figures are in the text.
  const floor = Math.max(0, Math.floor(lowest.pct / 10) * 10 - 10);
  return (
    <figure>
      <figcaption className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] font-bold">{title}</span>
        <span className="whitespace-nowrap font-mono text-[11px] text-muted">
          <span className="text-sm font-bold text-ink">{formatPercent(latest.pct)}</span> em {name(latest)}
        </span>
      </figcaption>
      <div role="img" aria-label={label}>
        <div aria-hidden="true" className="flex h-10 items-end gap-px">
          {points.map((point, index) => (
            <span
              key={point.id}
              title={`${name(point)}: ${formatPercent(point.pct)}`}
              className={`min-w-0 flex-1 rounded-t-sm ${index === points.length - 1 ? "bg-ink" : point.second ? "bg-muted/30" : "bg-muted/55"}`}
              style={{ height: `${Math.max(8, ((point.pct - floor) / (100 - floor)) * 100)}%` }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="mt-1 flex justify-between font-mono text-[10px] text-muted">
          <span>{points[0]!.year}</span>
          <span>{latest.year}</span>
        </div>
        {points.length > 2 && (
          <p aria-hidden="true" className="mt-1 font-mono text-[10px] text-muted">
            Máx. {formatPercent(highest.pct)} ({name(highest)}) · mín. {formatPercent(lowest.pct)} ({name(lowest)})
          </p>
        )}
      </div>
    </figure>
  );
}

function ElectionCard({ election, parties }: { election: Election; parties: Party[] }) {
  const { winner, turnout } = election;
  const total = turnout?.totalMandates ?? null;
  const president = election.type === "presidenciais";
  const european = election.type === "europeias";
  // Local elections add up thousands of councillors across the country: no single majority to measure.
  const local = election.type === "autarquicas";
  const won = winner?.mandates ?? null;
  const secondRound = president && election.round === 2;
  const firstRound = president && !secondRound && (winner?.validPct ?? 0) > 50;
  // The bar: seats out of the total with the majority marked, or for a President the share of votes against 50%.
  const bar = president
    ? { value: (winner?.validPct ?? 0) / 100, mark: 0.5 }
    : total && won !== null && !local
      ? { value: won / total, mark: european ? null : majority(total) / total }
      : null;
  const note = president
    ? secondRound
      ? "Os dois mais votados da 1.ª volta"
      : firstRound
        ? "Mais de 50%: eleito sem segunda volta"
        : "Sem maioria à primeira volta"
    : total && won !== null && !local
      ? european
        ? `${won} de ${total} lugares portugueses`
        : majorityNote(won, total)
      : null;
  const detail = president
    ? secondRound
      ? "eleito à 2.ª volta"
      : firstRound
        ? "eleito à 1.ª volta"
        : ""
    : won !== null
      ? european && total
        ? `${won} de ${total} eurodeputados`
        : `${won} ${won === 1 ? "mandato" : "mandatos"}`
      : "";

  const content = (
    <>
      <span className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-muted">
        {formatLongDate(election.date)}
        {election.imported ? (
          <span aria-hidden="true">→</span>
        ) : (
          <span className="rounded-full border border-line px-2 py-0.5 text-ink">A importar</span>
        )}
      </span>
      <span className="mt-1 block text-xl font-bold">
        {election.name}
        {election.round === 2 && !/volta/i.test(election.name) && (
          <span className="ml-2 align-middle font-mono text-[11px] font-normal text-muted">2.ª volta</span>
        )}
      </span>
      {winner && (
        <>
          <span className="mt-2 flex items-center gap-2 text-sm font-bold">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: listColor(winner) }} />
            <span className="sr-only">Mais votado: </span>
            <span className="min-w-0 truncate">{listName(winner, parties)}</span>
          </span>
          <span className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{formatPercent(winner.validPct)}</span>
            {detail && <span className="font-mono text-xs text-muted">{detail}</span>}
          </span>
        </>
      )}
      {bar && (
        <span aria-hidden="true" className="relative mt-3 block h-1.5 rounded-full bg-surface">
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.min(bar.value, 1) * 100}%`, backgroundColor: winner ? listColor(winner) : undefined }}
          />
          {bar.mark !== null && <span className="absolute -inset-y-1 border-l-2 border-ink" style={{ left: `${bar.mark * 100}%` }} />}
        </span>
      )}
      {note && <span className="mt-1.5 block font-mono text-[11px] text-muted">{note}</span>}
      {turnout?.turnoutPct != null && (
        <span className="mt-3 block border-t border-line pt-3 font-mono text-[11px] text-muted">
          Participação <span className="font-bold text-ink">{formatPercent(turnout.turnoutPct)}</span>
        </span>
      )}
    </>
  );
  const classes = "block h-full rounded-2xl border border-line p-4";
  // Results are only reachable once the import has finished.
  return election.imported ? (
    <Link href={electionPath(election.id)} className={`${classes} hover:bg-surface`}>
      {content}
    </Link>
  ) : (
    <div className={`${classes} border-dashed`}>{content}</div>
  );
}

const DEPTH: Record<NonNullable<Election["deepestLevel"]>, string | null> = {
  country: "só o resultado nacional",
  district: "até ao distrito",
  municipality: "até ao concelho",
  parish: null,
};

/** The older elections of a type, one line each, by decade: when, who won, by how much, and how far the results go. */
function OlderElections({ type, label, elections, parties }: { type: string; label: string; elections: Election[]; parties: Party[] }) {
  const decades = new Map<string, Election[]>();
  for (const election of elections) {
    const decade = `${election.date.slice(0, 3)}0`;
    decades.set(decade, [...(decades.get(decade) ?? []), election]);
  }
  return (
    <div className="mt-6">
      <h3 id={`antes-${type}`} className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
        {label} anteriores
      </h3>
      <div className="space-y-4">
        {[...decades].map(([decade, items]) => (
          <section key={decade} aria-label={`Anos ${decade.slice(2)}`}>
            <h4 className="mb-1 font-mono text-[11px] text-muted">Anos {decade.slice(2)}</h4>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {items.map((election) => {
                const { winner } = election;
                const depth = election.deepestLevel ? DEPTH[election.deepestLevel] : null;
                const name = (
                  <>
                    <span className="font-bold">{election.name}</span>
                    {election.round === 2 && !/volta/i.test(election.name) && <span className="text-muted"> · 2.ª volta</span>}
                  </>
                );
                return (
                  <li
                    key={election.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto]"
                  >
                    {election.imported ? (
                      <Link href={electionPath(election.id)} className="hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span>{name}</span>
                    )}
                    <span className="order-3 col-span-2 flex min-w-0 items-center gap-2 sm:order-none sm:col-span-1">
                      {winner ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: listColor(winner) }}
                          />
                          <span className="sr-only">Mais votado: </span>
                          <span className="min-w-0 truncate">{listName(winner, parties)}</span>
                          <span className="shrink-0 font-mono text-xs font-bold">{formatPercent(winner.validPct)}</span>
                          {winner.mandates ? (
                            <span className="shrink-0 font-mono text-xs text-muted">{winner.mandates} mandatos</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted">{election.imported ? "Sem resultados" : "A importar"}</span>
                      )}
                    </span>
                    <span className="hidden font-mono text-[11px] text-muted sm:block">
                      {election.turnout?.turnoutPct != null && <>Participação {formatPercent(election.turnout.turnoutPct)}</>}
                    </span>
                    <span className="text-right font-mono text-[11px] text-muted">{depth ?? formatLongDate(election.date)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Every coming election, regionais included, soonest first, in a column beside the results. None has a date until the decree. */
function Upcoming({ elections }: { elections: UpcomingElection[] }) {
  return (
    <section aria-labelledby="proximas" className="rounded-2xl border border-line p-4">
      <h2 id="proximas" className="font-mono text-xs font-bold uppercase tracking-widest">
        Próximas eleições
      </h2>
      <ol className="mt-2 divide-y divide-line">
        {elections.map((election) => (
          <li key={election.name} className="py-2.5" title={election.basis ?? undefined}>
            <p className="font-bold leading-snug">{election.name}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted">
              {election.date ? (
                <>
                  <time dateTime={election.date} className="text-ink">
                    {formatLongDate(election.date)}
                  </time>
                  {!election.confirmed && " · data por confirmar"}
                </>
              ) : (
                (election.window ?? "Ainda sem data marcada")
              )}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">A data só é oficial quando o decreto a marca.</p>
    </section>
  );
}

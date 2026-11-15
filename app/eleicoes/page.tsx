import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Chamber } from "@/components/Chamber";
import { ApiError, getElectionResult, getElections, getParties } from "@/lib/api/client";
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
import type { Election, ElectionResult, Party } from "@/lib/types";

export const metadata: Metadata = {
  title: "Eleições",
  description: "Os resultados das eleições em Portugal: legislativas, autárquicas, presidenciais e europeias, do país à freguesia.",
  alternates: { canonical: "/eleicoes" },
};

/** Null while the API does not serve elections yet, so the page can say so calmly. */
async function loadElections(): Promise<Election[] | null> {
  try {
    return await getElections();
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
  const [elections, parties] = await Promise.all([loadElections(), getParties().catch((): Party[] => [])]);
  const sorted = [...(elections ?? [])].sort(newestFirst);
  const latest = sorted.find((election) => election.imported) ?? null;
  const latestResult = latest ? await getElectionResult(latest.id).catch(() => null) : null;
  // Elections dated after today are the next ones: shown by their date, not as results.
  const today = new Date().toISOString().slice(0, 10);
  const types = ELECTION_TYPES.map((item) => {
    const ofType = sorted.filter((election) => election.type === item.type);
    const next = ofType.filter((election) => election.date > today).at(-1) ?? null;
    return { ...item, next, elections: ofType.filter((election) => election.date <= today) };
  }).filter((item) => item.elections.length > 0 || item.next);
  const since = sorted
    .filter((election) => election.date <= today)
    .at(-1)
    ?.date.slice(0, 4);

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Resultados oficiais</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Eleições</h1>
        <p className="mt-3 max-w-2xl leading-relaxed">
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

          {latest && latestResult && <Featured election={latest} result={latestResult} parties={parties} />}

          <div className="space-y-14">
            {types.map(({ type, label, about, next, elections: ofType }) => (
              <section key={type} aria-labelledby={`tipo-${type}`}>
                <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
                  <h2 id={`tipo-${type}`} className="scroll-mt-20 font-mono text-sm font-bold uppercase tracking-widest">
                    {label}
                  </h2>
                  <span className="font-mono text-xs text-muted">
                    {ofType.length} {ofType.length === 1 ? "eleição" : "eleições"}
                  </span>
                </div>
                <div className="mb-5 mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-xl">
                    {next && (
                      <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-ink px-3 py-1 font-mono text-xs">
                        <span className="font-bold">Próximas eleições</span>
                        <time dateTime={next.date}>{formatLongDate(next.date)}</time>
                      </p>
                    )}
                    <p className="text-sm text-muted">{about}</p>
                  </div>
                  <TurnoutBars elections={ofType} />
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ofType.slice(0, CARDS).map((election) => (
                    <li key={election.id}>
                      <ElectionCard election={election} parties={parties} />
                    </li>
                  ))}
                </ul>
                {ofType.length > CARDS && <OlderElections type={type} label={label} elections={ofType.slice(CARDS)} parties={parties} />}
              </section>
            ))}
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
function Featured({ election, result, parties }: { election: Election; result: ElectionResult; parties: Party[] }) {
  const total = result.turnout?.totalMandates ?? null;
  const lists = mergeSameParties(result.lists);
  const seated = total && total >= 10 ? chamberOrder(lists) : [];
  const top = lists.slice(0, 3);
  return (
    <section aria-labelledby="mais-recente" className="mb-14 rounded-2xl border border-line p-5 sm:p-6">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
            <span className="rounded-full bg-ink px-2 py-0.5 font-bold text-paper">Mais recente</span>
            {ELECTION_TYPES.find((item) => item.type === election.type)?.label} · {formatLongDate(election.date)}
          </p>
          <h2 id="mais-recente" className="mt-2 text-2xl font-bold sm:text-4xl">
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

/** Turnout in each election of a type, oldest to newest, the latest highlighted. */
function TurnoutBars({ elections }: { elections: Election[] }) {
  const points = elections
    .filter((election) => election.imported && election.turnout?.turnoutPct != null)
    .map((election) => ({ year: election.date.slice(0, 4), pct: election.turnout!.turnoutPct! }))
    .reverse();
  if (points.length < 2) return null;
  const label = `Participação ao longo do tempo: ${points.map((point) => `${point.year}, ${formatPercent(point.pct)}`).join("; ")}`;
  return (
    <figure className="shrink-0">
      <figcaption className="mb-1 font-mono text-[11px] text-muted">Participação ao longo do tempo</figcaption>
      <div role="img" aria-label={label} className="flex items-end gap-1.5">
        {points.map((point, index) => (
          <div key={point.year} aria-hidden="true" className="flex w-9 flex-col items-center gap-1 font-mono text-[10px] text-muted">
            <span>{formatPercent(point.pct)}</span>
            <span
              className={`w-5 rounded-sm ${index === points.length - 1 ? "bg-ink" : "bg-muted/50"}`}
              style={{ height: `${Math.max(4, ((point.pct - 20) / 60) * 36)}px` }}
            />
            <span>{point.year}</span>
          </div>
        ))}
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
  const firstRound = president && (winner?.validPct ?? 0) > 50;
  // The bar: seats out of the total with the majority marked, or for a President the share of votes against 50%.
  const bar = president
    ? { value: (winner?.validPct ?? 0) / 100, mark: 0.5 }
    : total && won !== null && !local
      ? { value: won / total, mark: european ? null : majority(total) / total }
      : null;
  const note = president
    ? firstRound
      ? "Mais de 50%: eleito sem segunda volta"
      : "Sem maioria à primeira volta"
    : total && won !== null && !local
      ? european
        ? `${won} de ${total} lugares portugueses`
        : majorityNote(won, total)
      : null;
  const detail = president
    ? firstRound
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
  national: "só o resultado nacional",
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

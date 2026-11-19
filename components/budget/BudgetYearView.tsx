import Link from "next/link";
import { getBudgetProposals, getBudgetSummary, type BudgetProposalPage, type BudgetSummary, type BudgetYear } from "@/lib/api/budget";
import {
  budgetBox,
  budgetStage,
  choiceShares,
  finalVoteSession,
  headlineVotes,
  partyFull,
  partyShort,
  proposalHeading,
  sessionTime,
} from "@/lib/budget";
import { budgetFilters, budgetPath, queryOf, RESULT_TABS, TAB_RESULTS, type BudgetFilters, type BudgetSearch } from "@/lib/budgetFilters";
import { formatDate, formatDayHeading, formatNumber, formatRelative, lisbonDay } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { BudgetBox } from "./BudgetBox";
import { HeadlineColumns, ProgressBar, ResultBadge, SharesBar, ToneBadge } from "./BudgetParts";
import { ProposalMeta, proposalPath } from "./ProposalItem";
import { ProposalList } from "./ProposalList";

const label = "font-mono text-[11px] font-bold uppercase tracking-widest";
const sectionHeading = "border-b-2 border-ink pb-1 font-mono text-xs font-bold uppercase tracking-widest";

/** Load what a year's page shows. The current one also gets today's votes. */
export async function loadBudgetYear(year: BudgetYear, current: boolean, search: BudgetSearch, now: number) {
  const today = lisbonDay(new Date(now).toISOString());
  const summary = year.proposals > 0 ? await getBudgetSummary(year.year).catch(() => null) : null;
  const filters = budgetFilters(search, {
    parties: summary?.parties.map((entry) => entry.party.slug) ?? [],
    topics: summary?.topics.map((entry) => entry.topic) ?? [],
  });
  const [page, todayPage] = await Promise.all([
    summary ? getBudgetProposals(year.year, queryOf(filters)).catch((): BudgetProposalPage | null => null) : null,
    summary && current && today ? getBudgetProposals(year.year, { votedFrom: today, votedTo: today, limit: 6 }).catch(() => null) : null,
  ]);
  return { summary, filters, page, todayPage, today };
}

type Loaded = Awaited<ReturnType<typeof loadBudgetYear>>;

/** The years at the top: the current one, the three before it, the rest in a fold. */
function YearTabs({ years, shown, currentYear }: { years: number[]; shown: number; currentYear: number }) {
  const first = years.slice(0, 4);
  const rest = years.slice(4);
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 font-mono text-xs font-bold ${active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;
  return (
    <nav aria-label="Orçamentos por ano" className="flex flex-wrap items-center gap-1.5">
      {first.map((year) => (
        <Link
          key={year}
          href={year === currentYear ? "/orcamento" : `/orcamento/${year}`}
          aria-current={year === shown ? "page" : undefined}
          className={pill(year === shown)}
        >
          {year === currentYear ? `OE ${year} · atual` : year}
        </Link>
      ))}
      {rest.length > 0 && (
        <details className="relative">
          <summary className={`${pill(rest.includes(shown))} cursor-pointer list-none`}>
            {rest[0]} a {rest[rest.length - 1]} <span aria-hidden="true">▾</span>
          </summary>
          <ul className="absolute right-0 z-20 mt-1 grid max-h-72 w-56 grid-cols-3 gap-1 overflow-y-auto rounded-xl border border-line bg-paper p-2 shadow-lg">
            {rest.map((year) => (
              <li key={year}>
                <Link
                  href={`/orcamento/${year}`}
                  aria-current={year === shown ? "page" : undefined}
                  className="block rounded px-2 py-1 text-center font-mono text-xs hover:bg-surface"
                >
                  {year}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </nav>
  );
}

const sessionDays = (summary: BudgetSummary, now: number) => {
  const days = [
    ...new Set(summary.schedule.filter((item) => Date.parse(item.startsAt) > now).map((item) => lisbonDay(item.startsAt))),
  ].filter((day): day is string => Boolean(day));
  return days.map((day) => formatDate(day)?.slice(0, 5)).join(", ");
};

export function BudgetYearView({
  year,
  years,
  current,
  currentYear,
  loaded,
  now,
}: {
  year: BudgetYear;
  years: BudgetYear[];
  current: boolean;
  currentYear: number;
  loaded: Loaded;
  now: number;
}) {
  const { summary, filters, page, todayPage, today } = loaded;
  const stage = budgetStage(year.bills);
  const { general, final } = headlineVotes(year.bills);
  const headline = final ?? general;
  const bill = year.bills[year.bills.length - 1] ?? null;
  // Its day ahead of time, from the agenda; gone once the vote is in.
  const finalSession = !final && current && summary ? finalVoteSession(summary.schedule) : null;
  const acronymOf = (slug: string) => {
    const party = summary?.parties.find((entry) => entry.party.slug === slug)?.party;
    return party ? partyShort(party) : slug.toUpperCase();
  };
  const approved = (summary?.results.approved ?? 0) + (summary?.results.partially_approved ?? 0);
  const rejected = summary?.results.rejected ?? 0;
  const box =
    summary && current ? budgetBox({ bills: year.bills, schedule: summary.schedule, pending: year.pending }, now, { keep: true }) : null;
  const filtered = Boolean(filters.party || filters.topic || filters.q || filters.day);
  const tabCount = (key: (typeof RESULT_TABS)[number]["key"]) =>
    filtered || !summary
      ? null
      : key === null
        ? year.proposals
        : TAB_RESULTS[key].reduce((sum, result) => sum + (summary.results[result] ?? 0), 0);
  const at = (next: Partial<BudgetFilters>) => budgetPath(year.year, current, { ...filters, ...next }, "#propostas");
  const todayVoted = todayPage?.items ?? [];

  return (
    <div data-wide className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <header className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {current ? (
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Orçamento do Estado</p>
            ) : (
              <Link href="/orcamento" className="font-mono text-xs uppercase tracking-widest text-muted hover:underline">
                <span aria-hidden="true">← </span>Orçamento do Estado
              </Link>
            )}
            <YearTabs years={years.map((item) => item.year)} shown={year.year} currentYear={currentYear} />
          </div>
          <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl">Orçamento do Estado {year.year}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            {stage && <ToneBadge tone={stage.tone}>{stage.label}</ToneBadge>}
            {final ? (
              <span>Votação final global a {formatDate(final.date)}</span>
            ) : general ? (
              <span>
                {/^aprovad/i.test(general.result) ? "Aprovado" : "Chumbado"} na generalidade a {formatDate(general.date)}
              </span>
            ) : null}
            {finalSession && general && <span aria-hidden="true">·</span>}
            {finalSession && (
              <span>
                Votação final global marcada para {formatDate(finalSession.startsAt)}
                {!finalSession.allDay && sessionTime(finalSession.startsAt) ? `, às ${sessionTime(finalSession.startsAt)}` : ""}
              </span>
            )}
            {bill?.legislature && !current && <span>· {bill.legislature} Legislatura</span>}
            {current && year.syncedAt && <span>· atualizado {formatRelative(year.syncedAt, now)}</span>}
          </p>
        </header>

        {headline && (
          <section aria-labelledby="votacao-do-orcamento" className="mb-6 rounded-2xl border border-line p-4">
            <h2 id="votacao-do-orcamento" className={`${label} mb-3 text-muted`}>
              {headline.phase ?? "Votação"}
            </h2>
            <HeadlineColumns vote={headline} acronymOf={acronymOf} />
            {!current && summary && (
              <p className="mt-3 flex flex-wrap gap-x-4 font-mono text-xs">
                <span className="font-bold">{formatNumber(year.proposals)} propostas de alteração</span>
                <span>
                  <span aria-hidden="true" style={{ color: "var(--favor)" }}>
                    ●{" "}
                  </span>
                  {formatNumber(approved)} aprovadas
                </span>
                <span>
                  <span aria-hidden="true" style={{ color: "var(--contra)" }}>
                    ●{" "}
                  </span>
                  {formatNumber(rejected)} rejeitadas
                </span>
              </p>
            )}
            {current && bill?.initiativeId && (
              <Link href={`/iniciativas/${bill.initiativeId}`} className="mt-3 inline-block font-mono text-xs font-bold underline">
                A proposta de lei do Orçamento <span aria-hidden="true">→</span>
              </Link>
            )}
          </section>
        )}

        {!summary && year.proposals === 0 && (
          <p className="mb-6 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            A fonte oficial não tem as propostas de alteração deste Orçamento, só as votações da proposta de lei.
          </p>
        )}
        {!summary && year.proposals > 0 && (
          <p className="mb-6 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            Não foi possível carregar as propostas de alteração. Tenta daqui a pouco.
          </p>
        )}

        {summary && current && (
          <section aria-labelledby="contagem" className="mb-8 rounded-2xl border border-line p-4">
            <h2 id="contagem" className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <span className="font-serif text-4xl font-bold">{formatNumber(year.voted)}</span>{" "}
                <span className="text-sm">
                  propostas de alteração já votadas, de <strong>{formatNumber(year.proposals)}</strong>
                </span>
              </span>
              <span className="font-mono text-xs text-muted">{formatNumber(year.pending)} por votar</span>
            </h2>
            <div className="mt-3">
              <ProgressBar approved={approved} rejected={rejected} total={year.proposals} label="Propostas de alteração" />
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted">
              <span className="flex flex-wrap gap-3">
                <span>
                  <span aria-hidden="true" style={{ color: "var(--favor)" }}>
                    ●{" "}
                  </span>
                  {formatNumber(approved)} aprovadas
                </span>
                <span>
                  <span aria-hidden="true" style={{ color: "var(--contra)" }}>
                    ●{" "}
                  </span>
                  {formatNumber(rejected)} rejeitadas
                </span>
                <span>{formatNumber(year.pending)} por votar</span>
              </span>
              {sessionDays(summary, now) && <span>Próximos dias de votação: {sessionDays(summary, now)}</span>}
            </p>
          </section>
        )}

        {summary && current && year.pending > 0 && (
          <section aria-labelledby="hoje" className="mb-8">
            <h2 id="hoje" className={`${sectionHeading} flex flex-wrap justify-between gap-2`}>
              <span>Votações de hoje</span>
              <span className="font-normal normal-case tracking-normal text-muted">
                {formatDayHeading(today, now)?.replace(/^Hoje · /, "")}
              </span>
            </h2>
            {todayVoted.length > 0 ? (
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <div
                  className="rounded-2xl border border-line p-4"
                  style={{ borderColor: box?.state === "session" ? "var(--contra)" : undefined }}
                >
                  {box?.state === "session" && (
                    <p className={label} style={{ color: "var(--contra)" }}>
                      <span aria-hidden="true">● </span>Sessão de votação · começou às {sessionTime(box.session.startsAt)} ·{" "}
                      {box.session.title}
                    </p>
                  )}
                  <p className={`${label} mt-2 text-muted`}>Última votação</p>
                  <h3 className="mt-1 font-serif text-xl font-bold leading-snug [overflow-wrap:anywhere]">
                    {proposalHeading(todayVoted[0]!).main}
                  </h3>
                  {todayVoted[0]!.plain && (
                    <p className="font-mono text-[11px] text-muted [overflow-wrap:anywhere]">{todayVoted[0]!.title}</p>
                  )}
                  <ProposalMeta proposal={todayVoted[0]!} today={today} />
                  {todayVoted[0]!.plain && <p className="mt-2 text-sm leading-snug">{todayVoted[0]!.plain.summary}</p>}
                  <p className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={proposalPath(todayVoted[0]!)}
                      className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
                    >
                      Ver proposta
                    </Link>
                    {todayVoted[0]!.documentUrl && (
                      <a
                        href={todayVoted[0]!.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
                      >
                        PDF oficial <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-line p-4">
                  <p className={`${label} text-muted`}>Já votadas hoje · {formatNumber(todayPage?.total ?? todayVoted.length)}</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {todayVoted.slice(0, 5).map((proposal) => (
                      <li key={proposal.id} className="flex items-start gap-2">
                        <ResultBadge result={proposal.result} />
                        <Link href={proposalPath(proposal)} className="text-sm font-bold leading-snug hover:underline">
                          {proposalHeading(proposal).main}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={at({ day: today, result: null })} className="mt-3 inline-block font-mono text-xs font-bold underline">
                    Ver todas as de hoje <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
                Hoje ainda não houve votações.
                {box?.state === "between" && box.next ? ` Próxima sessão de votação: ${formatDayHeading(box.next.startsAt, now)}.` : ""}
              </p>
            )}
          </section>
        )}

        {summary && summary.parties.length > 0 && (
          <section aria-labelledby="partidos" className="mb-8">
            <h2 id="partidos" className={sectionHeading}>
              {current ? "Como está a votar cada partido" : "Resumo por partido"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Os votos de cada partido nas propostas apresentadas pelos outros partidos, sem contar ausências.
            </p>
            <ul className="mt-2 flex flex-col">
              {summary.parties.map((entry) => {
                const shares = choiceShares(entry.votesOnOthers);
                const passed = (entry.results.approved ?? 0) + (entry.results.partially_approved ?? 0);
                return (
                  <li
                    key={entry.party.slug}
                    className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-line py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_14rem]"
                  >
                    <Link
                      href={at({ party: entry.party.slug })}
                      className="flex items-center gap-1.5 font-mono text-sm font-bold hover:underline"
                    >
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(entry.party.slug) }} />
                      {partyShort(entry.party)}
                    </Link>
                    <div className="min-w-0">
                      {shares ? (
                        <SharesBar shares={shares} label={partyFull(entry.party)} />
                      ) : (
                        <p className="font-mono text-xs text-muted">Sem votos ainda</p>
                      )}
                      {shares && (
                        <p className="mt-0.5 font-mono text-[11px] text-muted">
                          {shares.favor}% a favor · {shares.abstention}% abst. · {shares.against}% contra · de{" "}
                          {formatNumber(entry.votesOnOthers.favor + entry.votesOnOthers.abstention + entry.votesOnOthers.against)} votos
                        </p>
                      )}
                    </div>
                    <p className="col-span-2 font-mono text-xs text-muted sm:col-span-1 sm:text-right">
                      propôs <strong className="text-ink">{formatNumber(entry.proposals)}</strong> · aprovadas{" "}
                      <strong style={{ color: "var(--favor)" }}>{formatNumber(passed)}</strong>
                      {entry.proposals > 0 && ` (${Math.round((passed / entry.proposals) * 100)}%)`}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex gap-3 font-mono text-[11px] text-muted">
              <span>
                <span aria-hidden="true" style={{ color: "var(--favor)" }}>
                  ●
                </span>{" "}
                a favor
              </span>
              <span>
                <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                  ●
                </span>{" "}
                abstenção
              </span>
              <span>
                <span aria-hidden="true" style={{ color: "var(--contra)" }}>
                  ●
                </span>{" "}
                contra
              </span>
            </p>
          </section>
        )}

        {summary && (
          <section aria-labelledby="propostas-titulo" id="propostas" className="scroll-mt-24">
            <h2 id="propostas-titulo" className={sectionHeading}>
              {current ? "As propostas de alteração" : "Todas as propostas"}
            </h2>
            <form method="get" action={current ? "/orcamento" : `/orcamento/${year.year}`} className="mt-3 flex flex-wrap gap-2">
              {filters.party && <input type="hidden" name="partido" value={filters.party} />}
              {filters.result && <input type="hidden" name="resultado" value={filters.result} />}
              <label className="min-w-0 flex-1 basis-60">
                <span className="sr-only">Procurar nas propostas</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Procurar: IRS, IVA, artigo 9.º…"
                  className="w-full rounded-full border border-line bg-paper px-4 py-2 text-sm"
                />
              </label>
              {summary.topics.length > 0 && (
                <label className="min-w-0 max-w-full">
                  <span className="sr-only">Tema</span>
                  <select
                    name="tema"
                    defaultValue={filters.topic ?? ""}
                    // A select is as wide as its longest option («Orçamento, Finanças e Administração Pública»): kept in.
                    className="w-full max-w-full truncate rounded-full border border-line bg-paper px-3 py-2 font-mono text-xs sm:w-auto sm:max-w-64"
                  >
                    <option value="">Tema</option>
                    {summary.topics.map((entry) => (
                      <option key={entry.topic} value={entry.topic}>
                        {entry.topic} ({formatNumber(entry.proposals)})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-1 rounded-full border border-line px-3 font-mono text-xs">
                <span>Dia de votação</span>
                <input type="date" name="dia" defaultValue={filters.day ?? ""} className="bg-transparent py-2" />
              </label>
              <button type="submit" className="rounded-full border border-ink bg-ink px-4 py-2 font-mono text-xs font-bold text-paper">
                Filtrar
              </button>
            </form>
            <nav aria-label="Proposta por" className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted">Proposta por</span>
              {summary.parties.map((entry) => (
                <Link
                  key={entry.party.slug}
                  href={at({ party: filters.party === entry.party.slug ? null : entry.party.slug })}
                  aria-current={filters.party === entry.party.slug ? "true" : undefined}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${filters.party === entry.party.slug ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`}
                >
                  {partyShort(entry.party)}
                </Link>
              ))}
            </nav>
            <nav aria-label="Resultado" className="mt-3 flex flex-wrap gap-4 border-b border-line">
              {RESULT_TABS.map((tab) => {
                const active = filters.result === tab.key;
                const count = tabCount(tab.key);
                return (
                  <Link
                    key={tab.label}
                    href={at({ result: tab.key })}
                    aria-current={active ? "page" : undefined}
                    className={`-mb-px border-b-2 pb-2 font-mono text-xs ${active ? "border-ink font-bold" : "border-transparent text-muted hover:text-ink"}`}
                  >
                    {tab.label}
                    {count !== null && ` ${formatNumber(count)}`}
                  </Link>
                );
              })}
            </nav>
            {(filters.day || filters.topic || filters.q) && (
              <p className="mt-2 font-mono text-xs text-muted">
                {[
                  filters.day && `Votadas a ${formatDate(filters.day)}`,
                  filters.topic && `Tema: ${filters.topic}`,
                  filters.q && `«${filters.q}»`,
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                ·{" "}
                <Link
                  href={budgetPath(year.year, current, { ...filters, day: null, topic: null, q: null }, "#propostas")}
                  className="underline"
                >
                  limpar
                </Link>
              </p>
            )}
            <div className="mt-2">
              {page ? (
                <ProposalList year={year.year} query={queryOf(filters)} initialPage={page} today={today} />
              ) : (
                <p role="alert" className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
                  Não foi possível carregar as propostas. Tenta daqui a pouco.
                </p>
              )}
            </div>
          </section>
        )}
        {summary?.sourceUrl && (
          <p className="mt-6 font-mono text-[11px] text-muted">
            Fonte:{" "}
            <a href={summary.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Parlamento, Dados Abertos › Orçamento do Estado
            </a>
            . Resultados nos termos do Parlamento.
          </p>
        )}
      </div>

      <aside aria-label="Ao lado do Orçamento" className="hidden xl:block">
        <div className="sticky top-20 flex flex-col gap-4">
          {current && summary && (
            <BudgetBox
              data={{ year, summary, latest: todayVoted[0] ?? page?.items.find((item) => item.votes.length > 0) ?? null }}
              now={now}
              keep
              headingId="caixa-orcamento-pagina"
            />
          )}
          <section aria-labelledby="anteriores" className="rounded-2xl border border-line p-4">
            <h2 id="anteriores" className={`${label}`}>
              Orçamentos anteriores
            </h2>
            <ul className="mt-2 flex flex-col">
              {years
                .filter((item) => item.year !== currentYear)
                .slice(0, 6)
                .map((item) => {
                  const itemStage = budgetStage(item.bills);
                  return (
                    <li key={item.year} className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-0">
                      <Link href={`/orcamento/${item.year}`} className="font-serif font-bold hover:underline">
                        OE {item.year}
                      </Link>
                      {itemStage && <ToneBadge tone={itemStage.tone}>{itemStage.label}</ToneBadge>}
                    </li>
                  );
                })}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}

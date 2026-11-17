import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { Chamber } from "@/components/Chamber";
import { GovernmentCard } from "@/components/HistoryExplorer";
import { LegislatureEvents } from "@/components/LegislatureEvents";
import { PartyLogo } from "@/components/PartyLogo";
import { getCaseGlossary } from "@/lib/api/cases";
import { getLegislature, getLegislatures, isLegislatureId, legislaturePath, type Legislature } from "@/lib/api/legislatures";
import { electionPath } from "@/lib/elections";
import { FEATURES } from "@/lib/features";
import { formatDate, formatLongDate, formatNumber } from "@/lib/format";
import { durationLabel } from "@/lib/history";
import { partyColor } from "@/lib/parliament";

type Props = { params: Promise<{ id: string }> };

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });

const load = cache(async (raw: string) => {
  const id = decodeURIComponent(raw);
  return isLegislatureId(id) ? getLegislature(id) : null;
});

const yearsOf = (legislature: Pick<Legislature, "start" | "end">) => {
  const from = legislature.start.slice(0, 4);
  const to = legislature.end?.slice(0, 4);
  return to ? (to === from ? from : `${from}–${to}`) : `${from}–hoje`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const legislature = await load((await params).id);
  if (!legislature) return { title: "Legislatura não encontrada" };
  return {
    title: `${legislature.name} (${yearsOf(legislature)})`,
    description: `${legislature.name}: quem foi eleito, quem governou, o que o Parlamento propôs e aprovou, e o que aconteceu entre ${yearsOf(legislature)}.`,
    alternates: { canonical: legislaturePath(legislature.id) },
  };
}

/** The open data is thin before the 1990s: the numbers say what is recorded, not what happened. */
const INCOMPLETE_BEFORE = "1991";

export default async function LegislaturePage({ params }: Props) {
  await connection();
  const [legislature, all] = await Promise.all([load((await params).id), getLegislatures().catch(() => [])]);
  if (!legislature) notFound();
  const glossary = FEATURES.record && legislature.cases.length > 0 ? await getCaseGlossary().catch(() => null) : null;
  const index = all.findIndex((item) => item.id === legislature.id);
  // The list is newest first: the next legislature is the one before it in the list.
  const newer = index > 0 ? all[index - 1] : null;
  const older = index >= 0 && index < all.length - 1 ? all[index + 1] : null;
  const totals = legislature.initiativeTotals;
  const incomplete = !legislature.current && legislature.start.slice(0, 4) < INCOMPLETE_BEFORE;
  const authors = totals.byAuthor.filter((author) => author.submitted > 0).slice(0, 12);
  const topAuthor = Math.max(1, ...authors.map((author) => author.submitted));
  const end = legislature.end ?? today();

  return (
    <article data-wide className="pb-4">
      <nav aria-label="Caminho" className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        <Link href="/historia" className="hover:text-ink hover:underline">
          ← História
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/legislaturas" className="hover:text-ink hover:underline">
          Legislaturas
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{legislature.id}</span>
      </nav>

      <header
        className={`grid items-end gap-6 ${legislature.electionResults.length > 1 ? "lg:grid-cols-[minmax(0,1fr)_36rem]" : "lg:grid-cols-[minmax(0,1fr)_24rem]"}`}
      >
        <div>
          <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
            Assembleia da República · {yearsOf(legislature)}
            {legislature.current && (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--stage-law)_15%,transparent)] px-2 py-0.5 font-bold normal-case tracking-normal text-[var(--stage-law)]">
                Em funções
              </span>
            )}
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">{legislature.name}</h1>
          <p className="mt-2 text-lg text-muted">
            {formatLongDate(legislature.start)} {legislature.end ? `a ${formatLongDate(legislature.end)}` : "até hoje"} ·{" "}
            {durationLabel(legislature.start, end)}
          </p>
          {legislature.primeMinisters.length > 0 && (
            <p className="mt-3">
              <span className="font-mono text-xs uppercase tracking-widest text-muted">
                {legislature.primeMinisters.length === 1 ? "Primeiro-Ministro " : "Primeiros-Ministros "}
              </span>
              <b>{legislature.primeMinisters.join(", ")}</b>
            </p>
          )}
        </div>
        {legislature.electionResults[0] && <Seats legislature={legislature} />}
      </header>

      <div className="mt-10 grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {legislature.eventList.length > 0 && (
            <Section id="aconteceu" title="O que aconteceu">
              <LegislatureEvents events={legislature.eventList} />
            </Section>
          )}

          <Section id="parlamento" title="No Parlamento">
            {totals.submitted === 0 ? (
              <p className="text-muted">Sem iniciativas registadas nos dados abertos do Parlamento para esta legislatura.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile value={totals.submitted} label="iniciativas apresentadas" />
                  <Tile value={totals.approved} label="aprovadas" />
                  <Tile value={totals.laws} label="leis aprovadas" note="projetos e propostas de lei" />
                  <Tile value={totals.pending} label={legislature.current ? "ainda por decidir" : "caducaram no fim"} />
                </dl>
                {incomplete && (
                  <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-2 text-sm text-muted">
                    Registo incompleto nos dados abertos do Parlamento: há muito menos iniciativas registadas nas décadas de 1970 e 1980 do
                    que as que foram apresentadas. Os números servem para ter uma ideia, não para comparar com hoje.
                  </p>
                )}
                {authors.length > 0 && (
                  <>
                    <h3 className="mb-2 mt-6 font-mono text-xs font-bold uppercase tracking-widest">Quem propôs</h3>
                    <ul className="space-y-2">
                      {authors.map((author) => (
                        <li key={author.key} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2 font-bold">
                            {author.partySlug ? (
                              <PartyLogo slug={author.partySlug} acronym={author.name} size={18} />
                            ) : (
                              <span aria-hidden="true" className="size-[18px] shrink-0 rounded-full bg-surface" />
                            )}
                            <span className="truncate" title={author.name}>
                              {author.partySlug ? (
                                <Link href={`/partido/${author.partySlug}`} className="hover:underline">
                                  {author.name}
                                </Link>
                              ) : (
                                author.name
                              )}
                            </span>
                          </span>
                          <span aria-hidden="true" className="relative h-3 overflow-hidden rounded-full bg-surface">
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{
                                width: `${(author.submitted / topAuthor) * 100}%`,
                                backgroundColor: `color-mix(in srgb, ${author.partySlug ? partyColor(author.partySlug) : "var(--muted)"} 35%, transparent)`,
                              }}
                            />
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{
                                width: `${(author.approved / topAuthor) * 100}%`,
                                backgroundColor: author.partySlug ? partyColor(author.partySlug) : "var(--muted)",
                              }}
                            />
                          </span>
                          <span className="whitespace-nowrap font-mono text-xs text-muted">
                            <b className="text-ink">{formatNumber(author.submitted)}</b> · {formatNumber(author.approved)} aprovadas
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 font-mono text-[11px] text-muted">
                      Barra clara: apresentadas; barra cheia: aprovadas. Uma iniciativa assinada por vários partidos conta para cada um.
                    </p>
                  </>
                )}
              </>
            )}
          </Section>

          {glossary && legislature.cases.length > 0 && (
            <Section id="casos" title="Casos na justiça">
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {legislature.cases.map((item) => (
                  <li key={item.id} className="p-4">
                    <Link href={`/registo/${item.id}`} className="font-bold hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {glossary.caseStatuses.find((term) => term.key === item.status)?.label ?? item.status}
                      {item.statusDate && ` · ${formatDate(item.statusDate)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside
          aria-label="Quem governou"
          className="flex flex-col gap-4 no-scrollbar xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain xl:pb-2"
        >
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">Quem governou</h2>
          {legislature.governments.map((government) => (
            <GovernmentCard key={government.code} government={government} today={today()} heading="h3" />
          ))}
          {legislature.presidents.length > 0 && (
            <section aria-labelledby="presidentes" className="rounded-2xl border border-line p-4">
              <h3 id="presidentes" className="mb-2 font-mono text-xs font-bold uppercase tracking-widest">
                Presidente{legislature.presidents.length > 1 ? "s" : ""} da República
              </h3>
              <ul className="space-y-1.5 text-sm">
                {legislature.presidents.map((president) => (
                  <li key={president.id}>
                    <b>{president.name}</b>
                    <span className="block font-mono text-[11px] text-muted">
                      {president.termStart.slice(0, 4)}–{president.termEnd ? president.termEnd.slice(0, 4) : "hoje"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {legislature.id === "Constituinte" && (
            <p className="text-sm text-muted">
              A Assembleia Constituinte escreveu a Constituição de 1976; o Presidente da República ainda não era eleito por ela.
            </p>
          )}
        </aside>
      </div>

      <nav aria-label="Outras legislaturas" className="mt-12 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
        {older ? (
          <Link href={legislaturePath(older.id)} className="rounded-2xl border border-line p-4 hover:bg-surface">
            <span className="block font-mono text-[11px] text-muted">← Anterior</span>
            <span className="block font-bold">
              {older.name} <span className="font-normal text-muted">({yearsOf(older)})</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link href={legislaturePath(newer.id)} className="rounded-2xl border border-line p-4 text-right hover:bg-surface">
            <span className="block font-mono text-[11px] text-muted">Seguinte →</span>
            <span className="block font-bold">
              {newer.name} <span className="font-normal text-muted">({yearsOf(newer)})</span>
            </span>
          </Link>
        )}
      </nav>

      <p className="mt-8 font-mono text-xs text-muted">
        Fontes: Assembleia da República (dados abertos), Comissão Nacional de Eleições, portal do Governo. Os acontecimentos foram
        escolhidos pela redação, cada um com as suas fontes.
      </p>
    </article>
  );
}

/** The chamber as elected, with the lists that won seats. The I Legislatura had two elections: the 1979 one finished its term. */
function Seats({ legislature }: { legislature: Legislature }) {
  return (
    <div className={`grid gap-4 ${legislature.electionResults.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {legislature.electionResults.map((election) => (
        <figure key={election.id} className="rounded-2xl border border-line p-4">
          <Chamber
            total={election.totalMandates}
            groups={election.seats.map((seat) => ({
              key: seat.list,
              seats: seat.mandates,
              color: seat.partySlugs[0] ? partyColor(seat.partySlugs[0]) : "var(--muted)",
            }))}
          >
            <span className="text-2xl font-bold">{election.totalMandates}</span>
            <span className="block font-mono text-[10px] text-muted">deputados</span>
          </Chamber>
          <figcaption className="mt-3">
            <ul aria-label={`Lugares eleitos em ${election.name}`} className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
              {election.seats.map((seat) => (
                <li key={seat.list} className="flex items-center gap-1.5" title={seat.name}>
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: seat.partySlugs[0] ? partyColor(seat.partySlugs[0]) : "var(--muted)" }}
                  />
                  <b>{seat.list}</b> {seat.mandates}
                </li>
              ))}
            </ul>
            <Link href={electionPath(election.id)} className="mt-2 inline-block font-mono text-xs font-bold text-link underline">
              {election.name} →
            </Link>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-12">
      <h2 id={id} className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Tile({ value, label, note }: { value: number; label: string; note?: string }) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-line p-3">
      <dt className="font-mono text-[11px] leading-tight text-muted">
        {label}
        {note && <span className="block text-[10px]">{note}</span>}
      </dt>
      <dd className="text-2xl font-bold">{formatNumber(value)}</dd>
    </div>
  );
}

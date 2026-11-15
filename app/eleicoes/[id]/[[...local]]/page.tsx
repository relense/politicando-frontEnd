import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { ElectionResults, MandatesBar } from "@/components/ElectionResults";
import { ApiError, getElectionResult, getParties } from "@/lib/api/client";
import { CHILDREN_HEADING, electionPath, hasMandates, ORGAN_LABELS, typeLabel } from "@/lib/elections";
import { formatLongDate, formatNumber, formatPercent } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import type { ElectionResult, Party } from "@/lib/types";

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

export default async function ElectionPage(props: Props) {
  await connection();
  const [result, parties] = await Promise.all([resolve(props), getParties().catch((): Party[] => [])]);
  if (!result) notFound();

  const { election, organ, place, breadcrumb, turnout, lists, children } = result;
  const mainOrgan = election.organs[0];
  // The main body stays out of the address.
  const organParam = organ === mainOrgan ? null : organ;
  const seats = hasMandates(organ) && turnout?.totalMandates ? turnout.totalMandates : null;

  return (
    <div data-wide>
      <nav aria-label="Caminho" className="mb-3 flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted">
        <Link href="/eleicoes" className="hover:text-ink hover:underline">
          Eleições
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={electionPath(election.id, null, organParam)} className="hover:text-ink hover:underline">
          {election.name}
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

      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          {typeLabel(election.type)} · {formatLongDate(election.date)}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{place.level === "global" ? election.name : place.name}</h1>
        {place.level !== "global" && <p className="mt-1 text-muted">{election.name}</p>}
      </header>

      {election.organs.length > 1 && (
        <nav aria-label="Órgão" className="mb-6 flex flex-wrap gap-2">
          {election.organs.map((code) => (
            <Link
              key={code}
              href={electionPath(election.id, place.level === "global" ? null : place.key, code === mainOrgan ? null : code)}
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
        <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Participação" value={formatPercent(turnout.turnoutPct)} />
          <Fact label="Votantes" value={turnout.voters !== null ? formatNumber(turnout.voters) : null} />
          <Fact label="Inscritos" value={turnout.registered !== null ? formatNumber(turnout.registered) : null} />
          <Fact
            label="Brancos · nulos"
            value={
              turnout.blank !== null && turnout.null !== null ? `${formatNumber(turnout.blank)} · ${formatNumber(turnout.null)}` : null
            }
          />
        </dl>
      )}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="resultados">
          <h2 id="resultados" className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
            Resultados <span className="font-normal normal-case tracking-normal text-muted">· {ORGAN_LABELS[organ] ?? organ}</span>
          </h2>
          {seats && (
            <div className="mb-4">
              <MandatesBar lists={lists} total={seats} parties={parties} />
            </div>
          )}
          <ElectionResults lists={lists} parties={parties} withMandates={Boolean(seats)} />
          <p className="mt-3 text-xs text-muted">
            Percentagens sobre os votos válidos (sem brancos nem nulos), como nos resultados oficiais.
          </p>
        </section>

        {children.length > 0 && (
          <section aria-labelledby="locais">
            <h2 id="locais" className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
              {CHILDREN_HEADING[children[0]!.level]}
            </h2>
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
          </section>
        )}
      </div>

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
        .
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-surface p-3">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold">{value}</dd>
    </div>
  );
}

/** A winner's short name: our party's acronym when it is one of ours, the ballot's otherwise. */
function winnerName(winner: { list: string; partySlugs: string[] }, parties: Party[]): string {
  const acronyms = winner.partySlugs.map((slug) => parties.find((party) => party.slug === slug)?.acronym).filter(Boolean);
  return acronyms.length > 0 ? acronyms.join("/") : winner.list;
}

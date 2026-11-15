import Link from "next/link";
import {
  featuredPath,
  listStanding,
  seatOrder,
  type Candidate,
  type CandidateList,
  type Candidates,
  type Dhondt,
  type FeaturedPerson,
} from "@/lib/api/becomeDeputy";
import { listColor, listLabel } from "@/lib/elections";
import { formatNumber } from "@/lib/format";
import type { Party } from "@/lib/types";

/** The 230 seats, círculo by círculo, as bars: Lisboa elects about fifty, the smallest two or three. */
export function SeatsByCircle({ circles, current }: { circles: { key: string; name: string; seats: number }[]; current: string }) {
  const top = Math.max(...circles.map((item) => item.seats), 1);
  const total = circles.reduce((sum, item) => sum + item.seats, 0);
  return (
    <figure className="rounded-2xl border border-line p-4">
      <figcaption className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">
        Deputados por círculo · {total} no total
      </figcaption>
      <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {circles.map((item) => (
          <li key={item.key}>
            <Link
              href={`/como-ser-deputado?circulo=${item.key}#circulo`}
              scroll={false}
              aria-current={item.key === current ? "true" : undefined}
              className="-mx-1 grid grid-cols-[7.5rem_minmax(0,1fr)_2rem] items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-surface"
            >
              <span className={`truncate ${item.key === current ? "font-bold" : ""}`}>{item.name}</span>
              <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-surface">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(item.seats / top) * 100}%` }} />
              </span>
              <span className="text-right font-mono text-xs font-bold">{item.seats}</span>
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** How many quotient columns to show: one past the most seats any list won, so the next seat is in view. */
const MAX_COLUMNS = 8;

/** The d'Hondt table of one círculo: votes ÷ 1, 2, 3…; the biggest results win the seats, in that order. */
export function DhondtTable({ dhondt, parties }: { dhondt: Dhondt; parties: Party[] }) {
  const order = seatOrder(dhondt.lists);
  const winners = dhondt.lists.filter((item) => item.seats > 0);
  // The lists that won seats, and the next few, so the closest misses show too.
  const rows = [...winners, ...dhondt.lists.filter((item) => item.seats === 0).slice(0, Math.max(2, 6 - winners.length))];
  const columns = Math.min(
    MAX_COLUMNS,
    Math.max(...rows.map((item) => item.seats), 0) + 1,
    Math.max(...rows.map((item) => item.quotients.length)),
  );
  const label = (list: string) => {
    const item = dhondt.lists.find((candidate) => candidate.list === list);
    return item ? listLabel(item, parties) : list;
  };

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="mb-3 leading-relaxed">
        Em <strong>{dhondt.place.name}</strong> elegem-se {dhondt.seats === 1 ? "1 deputado" : `${dhondt.seats} deputados`}.
        {dhondt.lastSeat && (
          <>
            {" "}
            O último lugar ({dhondt.seats}.º) foi para <strong>{label(dhondt.lastSeat.list)}</strong>, com{" "}
            {formatNumber(Math.round(dhondt.lastSeat.quotient))}
          </>
        )}
        {dhondt.firstLoser && (
          <>
            ; quem ficou mais perto de o ganhar foi <strong>{label(dhondt.firstLoser.list)}</strong>, com{" "}
            {formatNumber(Math.round(dhondt.firstLoser.quotient))}
          </>
        )}
        .
      </p>
      <div
        tabIndex={0}
        role="region"
        aria-label={`Tabela de Hondt de ${dhondt.place.name}`}
        className="no-scrollbar -mx-4 overflow-x-auto px-4"
      >
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Método de Hondt em {dhondt.place.name}: os votos de cada lista divididos por 1, 2, 3…; os maiores resultados ganham os lugares.
          </caption>
          <thead>
            <tr className="border-b border-line font-mono text-[11px] text-muted">
              <th scope="col" className="py-2 pr-3 font-normal">
                Lista
              </th>
              {Array.from({ length: columns }, (_, index) => (
                <th key={index} scope="col" className="px-1 py-2 text-right font-normal">
                  <span aria-hidden="true">÷{index + 1}</span>
                  <span className="sr-only">Votos a dividir por {index + 1}</span>
                </th>
              ))}
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                Lugares
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.list} className="border-b border-line align-middle">
                <th scope="row" className="min-w-40 py-2 pr-3 font-bold">
                  <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-sm" style={{ backgroundColor: listColor(item) }} />
                  {listLabel(item, parties)}
                  {item.votesShortOfNextSeat !== null && (
                    <span className="block font-mono text-[11px] font-normal text-muted">
                      faltaram {formatNumber(item.votesShortOfNextSeat)} votos para mais um deputado
                    </span>
                  )}
                </th>
                {Array.from({ length: columns }, (_, index) => {
                  const value = item.quotients[index];
                  const seat = order.get(`${item.list}:${index}`);
                  return (
                    <td key={index} className={`px-1 py-2 text-right font-mono text-xs ${seat ? "font-bold" : "text-muted"}`}>
                      {value === undefined ? (
                        ""
                      ) : seat ? (
                        <span className="inline-flex items-baseline gap-1 rounded bg-ink px-1.5 py-0.5 text-paper">
                          {formatNumber(Math.round(value))}
                          <span className="text-[9px]">
                            <span className="sr-only">, </span>
                            {seat}.º<span className="sr-only"> lugar</span>
                          </span>
                        </span>
                      ) : (
                        formatNumber(Math.round(value))
                      )}
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right text-lg font-bold">{item.seats || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted">
        A escuro, os quocientes que ganharam um lugar, com a ordem em que o ganharam.
        {columns < Math.max(...rows.map((item) => item.quotients.length)) && " Mostram-se só as primeiras divisões."}
      </p>
    </div>
  );
}

/** How many candidates of each list show before the rest fold away. */
const SHOWN_BELOW_LINE = 2;

function CandidateName({ candidate }: { candidate: Candidate }) {
  return candidate.deputyId !== null ? (
    <Link href={`/deputados/${candidate.deputyId}`} className="underline hover:text-link">
      {candidate.name}
    </Link>
  ) : (
    <span>{candidate.name}</span>
  );
}

function CandidateRow({ candidate, aboveLine }: { candidate: Candidate; aboveLine: boolean }) {
  const replaced = !aboveLine && candidate.deputyId !== null;
  return (
    <li className="flex items-baseline gap-2 py-0.5 text-sm">
      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted">{candidate.position}.</span>
      <span className={`min-w-0 ${aboveLine ? "font-bold" : ""}`}>
        <CandidateName candidate={candidate} />
        {candidate.elected && <span className="ml-2 font-mono text-[11px] font-normal text-muted">eleito</span>}
        {replaced && <span className="ml-2 font-mono text-[11px] font-normal text-muted">entrou por substituição</span>}
      </span>
    </li>
  );
}

function ListCard({ list, parties }: { list: CandidateList; parties: Party[] }) {
  const { above, below } = listStanding(list);
  const shown = below.slice(0, SHOWN_BELOW_LINE);
  const rest = below.slice(SHOWN_BELOW_LINE);
  return (
    <li className="rounded-2xl border border-line p-4">
      <h3 className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-bold">
          <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-sm" style={{ backgroundColor: listColor(list) }} />
          {listLabel(list, parties)}
        </span>
        <span className="font-mono text-xs text-muted">{list.seats === 1 ? "1 eleito" : `${list.seats} eleitos`}</span>
      </h3>
      <ol aria-label={`Lista ${listLabel(list, parties)}`}>
        {above.map((candidate) => (
          <CandidateRow key={candidate.position} candidate={candidate} aboveLine />
        ))}
        {list.seats > 0 && below.length > 0 && (
          <li aria-hidden="true" className="my-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            <span className="h-px flex-1 border-t border-dashed border-ink" />
            linha de corte
            <span className="h-px flex-1 border-t border-dashed border-ink" />
          </li>
        )}
        {shown.map((candidate) => (
          <CandidateRow key={candidate.position} candidate={candidate} aboveLine={false} />
        ))}
      </ol>
      {(rest.length > 0 || list.alternates.length > 0) && (
        <details className="mt-1">
          <summary className="cursor-pointer font-mono text-xs text-link underline">
            {moreLabel(rest.length, list.alternates.length)}
          </summary>
          <ol className="mt-1">
            {rest.map((candidate) => (
              <CandidateRow key={candidate.position} candidate={candidate} aboveLine={false} />
            ))}
          </ol>
          {list.alternates.length > 0 && (
            <>
              <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Suplentes</p>
              <ol>
                {list.alternates.map((candidate) => (
                  <CandidateRow key={candidate.position} candidate={candidate} aboveLine={false} />
                ))}
              </ol>
            </>
          )}
        </details>
      )}
    </li>
  );
}

/** "Ver mais 3 candidatos e 2 suplentes", leaving out what there is none of. */
function moreLabel(candidates: number, alternates: number): string {
  const parts = [
    candidates > 0 ? `${candidates} ${candidates === 1 ? "candidato" : "candidatos"}` : null,
    alternates > 0 ? `${alternates} ${alternates === 1 ? "suplente" : "suplentes"}` : null,
  ].filter(Boolean);
  return `Ver ${candidates > 0 ? "mais " : "os "}${parts.join(" e ")}`;
}

/** The real lists in one círculo: in the party's order, with the line under the last one elected. */
export function CandidateLists({ candidates, parties, closest }: { candidates: Candidates; parties: Party[]; closest?: string }) {
  const elected = candidates.lists.filter((list) => list.seats > 0);
  // After the lists that won seats, the one that came closest to a seat, when the d'Hondt table says which.
  const next =
    candidates.lists.find((list) => list.seats === 0 && list.list === closest) ?? candidates.lists.find((list) => list.seats === 0);
  const lists = elected.length > 0 ? [...elected, ...(next ? [next] : [])] : candidates.lists.slice(0, 3);
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        As listas em {candidates.place.name}, pela ordem que cada partido escolheu. Quem fica acima da linha foi eleito.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {lists.map((list) => (
          <ListCard key={list.list} list={list} parties={parties} />
        ))}
      </ul>
    </div>
  );
}

/** Who took a seat from below the line in this círculo, replacing someone who left or went to the Government. */
export function Replacements({ candidates, circleName }: { candidates: Candidates; circleName: string }) {
  const entries = candidates.lists.flatMap((list) => listStanding(list).replacements.map((candidate) => ({ list, candidate })));
  return (
    <div className="rounded-2xl border border-line p-4">
      <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Em {circleName}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          Ninguém abaixo da linha de corte entrou por substituição neste círculo, segundo os nossos registos.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(({ list, candidate }) => (
            <li key={`${list.list}-${candidate.position}-${candidate.name}`}>
              <CandidateName candidate={candidate} />{" "}
              <span className="text-muted">
                ({list.candidates.includes(candidate) ? `n.º ${candidate.position}` : `suplente n.º ${candidate.position}`} da lista{" "}
                {list.list}) entrou por substituição.
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A few real people, linking to where their path is told. */
export function FeaturedPaths({ people }: { people: FeaturedPerson[] }) {
  return (
    <section aria-labelledby="percursos" className="mb-12 scroll-mt-24">
      <h2 id="percursos" className="mb-3 scroll-mt-24 text-2xl font-bold">
        Percursos reais
      </h2>
      <p className="mb-4 max-w-2xl leading-relaxed text-muted">
        Como chegaram lá algumas das pessoas que hoje ocupam os principais cargos.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.slice(0, 9).map((person) => {
          const href = featuredPath(person);
          const body = (
            <>
              <span className="block font-bold leading-snug">{person.name}</span>
              <span className="block font-mono text-xs text-muted">
                {person.role}
                {person.party && <> · {person.party.acronym}</>}
              </span>
            </>
          );
          return (
            <li key={`${person.kind}-${person.id}`}>
              {href ? (
                <Link href={href} className="block h-full rounded-2xl border border-line p-4 hover:bg-surface">
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-2xl border border-line p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

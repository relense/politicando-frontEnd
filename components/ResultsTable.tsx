"use client";

import Link from "next/link";
import { useState } from "react";

export type ResultRow = {
  key: string;
  name: string;
  color: string;
  parties: { slug: string; acronym: string; href: string }[];
  citizens: boolean;
  mandates: number | null;
  pct: string | null;
  share: number;
  votes: string;
  /** Change in points from the previous election, when that list ran there too: "+2,3 pp". */
  change?: { label: string; direction: "up" | "down" | "same" } | null;
};

/** How many lists show before the rest fold away. */
const SHOWN = 8;

/** Every list, most votes first: its share as a bar, its seats where there are seats, and its votes. */
export function ResultsTable({ rows, withMandates, compareTo }: { rows: ResultRow[]; withMandates: boolean; compareTo?: string }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return <p className="text-muted">Sem resultados para este local.</p>;
  const top = Math.max(...rows.map((row) => row.share), 1);
  const shown = open ? rows : rows.slice(0, SHOWN);

  return (
    <>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line font-mono text-[11px] text-muted">
            <th scope="col" className="w-6 py-2 font-normal sm:w-8">
              <span className="sr-only">Posição</span>
            </th>
            <th scope="col" className="py-2 font-normal">
              Lista
            </th>
            {withMandates && (
              <th scope="col" className="w-12 py-2 text-right font-normal sm:w-20">
                <span className="sm:hidden">Mand.</span>
                <span className="hidden sm:inline">Mandatos</span>
              </th>
            )}
            <th scope="col" className="w-14 py-2 text-right font-normal sm:w-20">
              Votos
            </th>
            {compareTo && (
              <th scope="col" className="w-14 whitespace-nowrap py-2 text-right font-normal sm:w-24">
                vs {compareTo}
              </th>
            )}
            <th scope="col" className="hidden w-28 py-2 text-right font-normal sm:table-cell">
              Votos (n.º)
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={row.key} className="border-b border-line align-middle">
              <td className="py-3 font-mono text-xs text-muted">{index + 1}</td>
              <td className="py-3 pr-2 sm:pr-4">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[15px] font-bold leading-snug sm:text-base">
                    <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-sm" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </span>
                  {row.parties.length > 0 && (
                    <span className="font-mono text-[11px] text-muted">
                      {row.parties.map((party, i) => (
                        <span key={party.slug}>
                          {i > 0 && " · "}
                          <Link href={party.href} className="hover:text-ink hover:underline">
                            {party.acronym}
                          </Link>
                        </span>
                      ))}
                    </span>
                  )}
                  {row.citizens && <span className="font-mono text-[11px] text-muted">movimento de cidadãos</span>}
                </span>
                <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(row.share / top) * 100}%`, backgroundColor: row.color }}
                  />
                </span>
              </td>
              {withMandates && <td className="py-3 text-right text-xl font-bold sm:text-2xl">{row.mandates || "–"}</td>}
              <td className="py-3 text-right font-mono text-sm font-bold">{row.pct}</td>
              {compareTo && (
                <td className="whitespace-nowrap py-3 pl-2 text-right font-mono text-xs text-muted">
                  {row.change ? (
                    <>
                      <span aria-hidden="true" className="hidden sm:inline">
                        {row.change.direction === "up" ? "▲ " : row.change.direction === "down" ? "▼ " : ""}
                      </span>
                      {row.change.label}
                    </>
                  ) : (
                    <span title="Sem lista comparável na eleição anterior">
                      <span aria-hidden="true">–</span>
                      <span className="sr-only">sem comparação</span>
                    </span>
                  )}
                </td>
              )}
              <td className="hidden py-3 text-right font-mono text-xs text-muted sm:table-cell">{row.votes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {rows.length > SHOWN ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
          >
            {open ? "Mostrar só as primeiras" : `Mostrar as outras ${rows.length - SHOWN} listas`}
          </button>
        ) : (
          <span />
        )}
        <p className="font-mono text-[11px] text-muted">
          Percentagens sobre os votos válidos (sem brancos nem nulos), como nos resultados oficiais.
        </p>
      </div>
    </>
  );
}

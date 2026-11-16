"use client";

import Link from "next/link";
import { useState } from "react";
import type { PathStep } from "@/lib/api/people";
import { fold } from "@/lib/format";
import { CareerTimeline } from "./CareerPath";
import { GovernmentPortrait } from "./GovernmentPortrait";

export type PathTone = "parliament" | "government" | "speaker" | "president" | "election";

export const TONE_COLOR: Record<PathTone, string> = {
  parliament: "var(--stage-approved)",
  government: "var(--stage-submitted)",
  speaker: "var(--end-programme)",
  president: "var(--stage-president)",
  election: "var(--stage-approved)",
};

export type PathCell = { label: string; tone: PathTone } | null;

export type PathRow = {
  key: string;
  name: string;
  role: string | null;
  photoUrl: string | null;
  party: { slug: string; acronym: string; color: string } | null;
  group: "top" | "leader";
  href: string;
  /** The legislature before, the last legislativas, the legislature now. */
  cells: [PathCell, PathCell, PathCell];
  today: { label: string; tone: PathTone } | null;
  stats: { value: string; label: string }[];
  steps: PathStep[];
};

type Props = {
  rows: PathRow[];
  columns: [{ title: string; note: string }, { title: string; note: string }, { title: string; note: string }];
};

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "top", label: "Cargos de topo" },
  { key: "leader", label: "Líderes partidários" },
] as const;

const LEGEND: { tone: PathTone; label: string }[] = [
  { tone: "parliament", label: "Parlamento" },
  { tone: "government", label: "Governo" },
  { tone: "speaker", label: "Presidência da AR" },
  { tone: "president", label: "Presidência da República" },
];

function Ring({ row, size }: { row: PathRow; size: "xs" | "sm" | "md" }) {
  return (
    <span className="shrink-0 rounded-full p-0.5" style={{ boxShadow: `0 0 0 2px ${row.party?.color ?? "var(--stage-president)"}` }}>
      <GovernmentPortrait name={row.name} photoUrl={row.photoUrl} size={size} />
    </span>
  );
}

function Cell({ cell, election = false }: { cell: PathCell; election?: boolean }) {
  if (!cell) {
    return (
      <span className="block">
        {!election && <span aria-hidden="true" className="block h-1.5 rounded-full border border-dashed border-line" />}
        <span className="mt-1 block font-mono text-[11px] text-muted">—</span>
      </span>
    );
  }
  return (
    <span className="block min-w-0">
      {!election && <span aria-hidden="true" className="block h-1.5 rounded-full" style={{ backgroundColor: TONE_COLOR[cell.tone] }} />}
      <span
        className="mt-1 block truncate font-mono text-[11px]"
        style={election ? { color: TONE_COLOR.election } : undefined}
        title={cell.label}
      >
        {cell.label}
      </span>
    </span>
  );
}

/**
 * The people at the top side by side, over the same stretch of time, with one opened in full beside the table.
 * Filters by office or party leadership, and a search by name.
 */
export function PathsExplorer({ rows, columns }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(rows.find((row) => row.group === "top" && row.party)?.key ?? rows[0]?.key ?? "");
  const words = fold(query.trim());
  const shown = rows.filter((row) => (filter === "all" || row.group === filter) && (!words || fold(row.name).includes(words)));
  const person = rows.find((row) => row.key === selected) ?? rows[0];

  return (
    <section aria-labelledby="lado-a-lado" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-2">
        <h2 id="lado-a-lado" className="font-mono text-sm font-bold uppercase tracking-widest">
          Lado a lado
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar uma pessoa"
            aria-label="Procurar uma pessoa"
            className="h-9 w-48 rounded-lg border border-line bg-paper px-3 font-mono text-xs"
          />
          <div role="group" aria-label="Mostrar" className="flex overflow-hidden rounded-lg border border-line">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`border-r border-line px-3 py-2 font-mono text-xs font-bold last:border-0 ${filter === item.key ? "bg-ink text-paper" : "hover:bg-surface"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        O que cada um fez desde as {columns[1].title.toLowerCase()}. Toca numa pessoa para ver o percurso completo ao lado.
      </p>

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[44rem] table-fixed text-left">
              <caption className="sr-only">Cargos de cada pessoa em cada período</caption>
              <thead>
                <tr className="border-b border-line font-mono text-[10px] uppercase tracking-widest text-muted">
                  <th scope="col" className="w-[30%] px-3 py-2.5 font-normal">
                    Pessoa
                  </th>
                  {columns.map((column) => (
                    <th key={column.title} scope="col" className="px-2 py-2.5 font-normal">
                      <span className="block font-bold">{column.title}</span>
                      <span className="block normal-case tracking-normal">{column.note}</span>
                    </th>
                  ))}
                  <th scope="col" className="w-[17%] px-2 py-2.5 font-normal">
                    Hoje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((row) => {
                  const active = row.key === person?.key;
                  return (
                    <tr
                      key={row.key}
                      className={active ? "bg-surface" : ""}
                      style={active ? { boxShadow: "inset 3px 0 0 var(--stage-debate)" } : undefined}
                    >
                      <th scope="row" className="px-3 py-2.5 font-normal">
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelected(row.key)}
                          className="flex w-full min-w-0 items-center gap-2.5 text-left"
                        >
                          <Ring row={row} size="xs" />
                          <span className="min-w-0">
                            <span className="block truncate font-bold leading-snug hover:underline">{row.name}</span>
                            <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-muted">
                              <span
                                aria-hidden="true"
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: row.party?.color ?? "var(--stage-president)" }}
                              />
                              {row.party?.acronym ?? "sem partido"}
                            </span>
                          </span>
                        </button>
                      </th>
                      <td className="px-2 py-2.5 align-middle">
                        <Cell cell={row.cells[0]} />
                      </td>
                      <td className="px-2 py-2.5 align-middle">
                        <Cell cell={row.cells[1]} election />
                      </td>
                      <td className="px-2 py-2.5 align-middle">
                        <Cell cell={row.cells[2]} />
                      </td>
                      <td className="px-2 py-2.5 align-middle">
                        {row.today && (
                          <span
                            className="inline-block max-w-full truncate rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold"
                            style={{
                              color: TONE_COLOR[row.today.tone],
                              backgroundColor: `color-mix(in srgb, ${TONE_COLOR[row.today.tone]} 15%, transparent)`,
                            }}
                            title={row.today.label}
                          >
                            {row.today.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                      Ninguém com esse nome nesta lista.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ul aria-label="Legenda" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
            {LEGEND.map((item) => (
              <li key={item.tone} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-1.5 w-3 rounded-full" style={{ backgroundColor: TONE_COLOR[item.tone] }} />
                {item.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-3 rounded-full border border-dashed border-line" />
              sem cargo
            </li>
          </ul>
        </div>

        {person && (
          <aside
            aria-label={`Percurso de ${person.name}`}
            aria-live="polite"
            className="overflow-hidden rounded-2xl border border-line xl:sticky xl:top-20"
          >
            <div
              className="p-4"
              style={{
                backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${person.party?.color ?? "var(--stage-president)"} 18%, transparent), transparent 70%)`,
              }}
            >
              <div className="flex items-center gap-3">
                <Ring row={person} size="md" />
                <div className="min-w-0">
                  <h3 className="text-xl font-bold leading-tight">{person.name}</h3>
                  {person.role && <p className="text-sm text-muted">{person.role}</p>}
                </div>
              </div>
              {person.stats.length > 0 && (
                <dl className="mt-4 grid grid-cols-3 gap-2">
                  {person.stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col-reverse rounded-xl border border-line bg-paper/60 p-2.5">
                      <dt className="font-mono text-[10px] leading-tight text-muted">{stat.label}</dt>
                      <dd className="text-xl font-bold leading-tight">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <div className="border-t border-line p-4">
              {person.steps.length > 0 ? (
                <CareerTimeline steps={person.steps} limit={4} />
              ) : (
                <p className="text-sm text-muted">Sem percurso registado nas fontes oficiais.</p>
              )}
            </div>
            <div className="border-t border-line p-4">
              <Link
                href={person.href}
                className="block rounded-lg bg-ink px-4 py-2.5 text-center font-mono text-xs font-bold text-paper hover:opacity-90"
              >
                Ver perfil completo<span className="sr-only"> de {person.name}</span> →
              </Link>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

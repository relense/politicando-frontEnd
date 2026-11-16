"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { electionPath } from "@/lib/elections";
import { formatDate } from "@/lib/format";
import {
  decadeLabel,
  decadeTicks,
  durationLabel,
  END_LABELS,
  endOf,
  endTone,
  groupsOf,
  REVOLUTION,
  spanOnAxis,
  TONE_COLOR,
  type HistoryGroup,
} from "@/lib/history";
import { partyColor } from "@/lib/parliament";
import type { HistoricalGovernment, TimelineEvent } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";

const FILTERS: { key: HistoryGroup | "all"; label: string; color: string | null }[] = [
  { key: "all", label: "Todos", color: null },
  { key: "ps", label: "Liderados pelo PS", color: partyColor("ps") },
  { key: "psd", label: "Liderados pelo PSD", color: partyColor("psd") },
  { key: "coalition", label: "Coligações", color: "var(--stage-debate)" },
  { key: "presidential", label: "Iniciativa presidencial", color: "var(--stage-president)" },
  { key: "provisional", label: "Provisórios", color: "var(--muted)" },
];

/** A party's colour, stripes of each partner for a coalition, hatching for governments without parties. */
export function fillOf(government: HistoricalGovernment): string {
  const colors = government.parties.map((party) => partyColor(party.slug));
  if (colors.length === 0) {
    const color = government.kind === "provisional" ? "var(--muted)" : "var(--stage-president)";
    return `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 6px)`;
  }
  if (colors.length === 1) return colors[0]!;
  const stripe = 5;
  const stops = colors.map((color, index) => `${color} ${index * stripe}px ${(index + 1) * stripe}px`).join(", ");
  return `repeating-linear-gradient(135deg, ${stops})`;
}

const accentOf = (government: HistoricalGovernment) =>
  government.parties[0]
    ? partyColor(government.parties[0].slug)
    : government.kind === "provisional"
      ? "var(--muted)"
      : "var(--stage-president)";

/** "XXV" from "XXV Governo Constitucional", "I Prov." from "I Governo Provisório". */
const numberOf = (government: HistoricalGovernment) => {
  const roman = government.name.split(" ")[0] ?? "";
  return government.kind === "provisional" ? `${roman} Prov.` : roman;
};

function EndBadge({ government }: { government: HistoricalGovernment }) {
  if (!government.endReason) return null;
  const tone = endTone(government.endReason);
  const color = TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {tone === "lasted" && <span aria-hidden="true">✓</span>}
      {END_LABELS[government.endReason]}
    </span>
  );
}

const presidentName = (title: string) => title.replace(/^Presidente da República:\s*/, "");

type Props = {
  /** Newest first. */
  governments: HistoricalGovernment[];
  presidents: TimelineEvent[];
  /** Legislativas and presidenciais, for each decade's header. */
  elections: TimelineEvent[];
  today: string;
  /** Shown between the bar and the list. */
  children?: ReactNode;
};

/**
 * Every government since 1974: one bar sized by time, filters by who led it, the chosen government in detail with
 * the one before and after a press away, and the list by decade below.
 */
export function HistoryExplorer({ governments, presidents, elections, today, children }: Props) {
  const [filter, setFilter] = useState<HistoryGroup | "all">("all");
  const [selected, setSelected] = useState(governments[0]?.code ?? "");
  const ordered = useMemo(() => [...governments].reverse(), [governments]);
  const matches = (government: HistoricalGovernment) => filter === "all" || groupsOf(government).includes(filter);
  const index = governments.findIndex((item) => item.code === selected);
  const current = governments[index] ?? governments[0]!;
  const longest = Math.max(...governments.map((item) => item.days));

  const decades = useMemo(() => {
    const out: { label: string; governments: HistoricalGovernment[]; elections: TimelineEvent[] }[] = [];
    for (const government of governments) {
      const label = decadeLabel(government.start);
      const last = out.at(-1);
      if (last?.label === label) last.governments.push(government);
      else out.push({ label, governments: [government], elections: [] });
    }
    for (const election of elections) out.find((decade) => decade.label === decadeLabel(election.date))?.elections.push(election);
    return out;
  }, [governments, elections]);

  const presidentAt = (day: string) => presidents.find((president) => president.date <= day && (president.endDate ?? "9999") > day) ?? null;
  const president = presidentAt(current.start);

  return (
    <>
      <section aria-labelledby="de-1974" className="rounded-2xl border border-line p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="de-1974" className="font-mono text-xs font-bold uppercase tracking-widest">
            De 1974 a hoje
          </h2>
          <span className="font-mono text-[11px] text-muted">
            Cada bloco é um governo, do tamanho do tempo que durou. Carrega para ver.
          </span>
        </div>
        <div role="group" aria-label="Mostrar" className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold ${
                filter === item.key ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
              }`}
            >
              {item.color && <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }} />}
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative h-14 overflow-hidden rounded-md bg-surface">
          {ordered.map((government) => {
            const { left, width } = spanOnAxis(government.start, endOf(government, today), REVOLUTION, today);
            const chosen = government.code === current.code;
            return (
              <button
                key={government.code}
                type="button"
                aria-pressed={chosen}
                aria-label={`${government.name}: ${government.primeMinister}, ${durationLabel(government.start, endOf(government, today))}`}
                title={`${government.name}: ${government.primeMinister}`}
                onClick={() => setSelected(government.code)}
                className={`absolute inset-y-0 border-r border-paper transition-opacity focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ink ${
                  matches(government) ? "" : "opacity-15"
                } ${chosen ? "z-10 outline outline-2 outline-offset-[-2px] outline-ink" : ""}`}
                style={{ left: `${left}%`, width: `${width}%`, background: fillOf(government) }}
              />
            );
          })}
        </div>
        {presidents.length > 0 && (
          <div aria-hidden="true" className="relative mt-1 h-6">
            {presidents.map((item, position) => {
              const { left, width } = spanOnAxis(item.date, item.endDate ?? today, REVOLUTION, today);
              return (
                <div
                  key={item.date}
                  title={item.title}
                  className={`absolute inset-y-0 flex items-center overflow-hidden rounded-sm border-r border-paper px-1.5 ${position % 2 ? "bg-line" : "bg-surface"}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="truncate font-mono text-[10px] text-ink">{presidentName(item.title).split(" ").at(-1)}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="relative mt-1 h-5" aria-hidden="true">
          {decadeTicks(REVOLUTION, today).map((year) => {
            const { left } = spanOnAxis(`${year}-01-01`, `${year}-01-01`, REVOLUTION, today);
            return (
              <span key={year} className="absolute -translate-x-1/2 font-mono text-[11px] text-muted" style={{ left: `${left}%` }}>
                {year}
              </span>
            );
          })}
        </div>
        {presidents.length > 0 && <p className="font-mono text-[11px] text-muted">Por baixo: o Presidente da República.</p>}

        <article
          aria-labelledby="governo-escolhido"
          aria-live="polite"
          className="mt-4 grid gap-4 rounded-xl border border-l-4 border-line bg-surface/50 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
          style={{ borderLeftColor: accentOf(current) }}
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
              {current.name}
              <EndBadge government={current} />
            </p>
            <h3 id="governo-escolhido" className="mt-1 text-2xl font-bold leading-tight">
              {current.primeMinister}
            </h3>
            <p className="mt-1 font-mono text-xs text-muted">
              {formatDate(current.start)} → {current.end ? formatDate(current.end) : "hoje"} ·{" "}
              {durationLabel(current.start, endOf(current, today))}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {current.parties.map((party) => (
                <span
                  key={party.slug}
                  className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-0.5 pr-2.5 font-mono text-xs font-bold"
                >
                  <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-white">
                    <PartyLogo slug={party.slug} acronym={party.acronym} size={16} />
                  </span>
                  {party.acronym}
                </span>
              ))}
              {current.support && <span className="text-sm text-muted">{current.support}</span>}
            </div>
            {current.endNote && <p className="mt-3 text-sm leading-relaxed">{current.endNote}</p>}
            {president && (
              <p className="mt-2 font-mono text-[11px] text-muted">Presidente da República quando tomou posse: {presidentName(president.title)}</p>
            )}
            {(current.current || current.portalUrl) && (
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                {current.current && (
                  <Link href="/governo" className="font-bold text-link underline">
                    Quem governa agora →
                  </Link>
                )}
                {current.portalUrl && (
                  <a href={current.portalUrl} className="text-link underline" target="_blank" rel="noopener noreferrer">
                    No portal do Governo<span className="sr-only"> (abre noutra janela)</span>
                  </a>
                )}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2 md:flex-col md:items-end">
            <button
              type="button"
              disabled={index >= governments.length - 1}
              onClick={() => setSelected(governments[index + 1]!.code)}
              className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => setSelected(governments[index - 1]!.code)}
              className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface disabled:opacity-40"
            >
              Seguinte →
            </button>
          </div>
        </article>
      </section>

      {children}

      <section aria-labelledby="governo-a-governo" className="mt-12">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
          <h2 id="governo-a-governo" className="font-mono text-sm font-bold uppercase tracking-widest">
            Governo a governo
          </h2>
          <span className="font-mono text-[11px] text-muted">
            {filter === "all"
              ? `${governments.length} governos`
              : `${governments.filter(matches).length} de ${governments.length} governos`}
          </span>
        </div>
        <div className="hidden grid-cols-[3.5rem_minmax(0,1.3fr)_minmax(0,1.4fr)_11rem] gap-3 px-2 pb-1 font-mono text-[11px] text-muted md:grid">
          <span>N.º</span>
          <span>Primeiro-Ministro</span>
          <span>Partidos e apoio</span>
          <span className="text-right">Duração e fim</span>
        </div>
        {decades.map((decade) => {
          const shown = decade.governments.filter(matches);
          if (shown.length === 0) return null;
          return (
            <section key={decade.label} aria-labelledby={`decada-${decade.label}`} className="mt-6">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 id={`decada-${decade.label}`} className="text-2xl font-bold">
                  {decade.label}
                </h3>
                {decade.elections.length > 0 && (
                  <span className="font-mono text-[11px] text-muted">
                    Eleições:{" "}
                    {decade.elections.map((election, position) => (
                      <span key={`${election.date}-${election.title}`}>
                        {position > 0 && " · "}
                        {election.electionId ? (
                          <Link href={electionPath(election.electionId)} className="underline hover:text-ink">
                            {election.title}
                          </Link>
                        ) : (
                          election.title
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <ol className="divide-y divide-line rounded-2xl border border-line">
                {shown.map((government) => (
                  <li key={government.code} id={government.code} className="scroll-mt-24">
                    <article
                      aria-labelledby={`${government.code}-nome`}
                      className="relative grid gap-x-3 gap-y-1 py-3 pl-5 pr-3 md:grid-cols-[3.5rem_minmax(0,1.3fr)_minmax(0,1.4fr)_11rem] md:items-center"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-1.5 w-1 rounded-full"
                        style={{ background: fillOf(government) }}
                      />
                      <span className="font-mono text-xs text-muted">{numberOf(government)}</span>
                      <span className="min-w-0">
                        <button
                          type="button"
                          id={`${government.code}-nome`}
                          onClick={() => {
                            setSelected(government.code);
                            document.getElementById("de-1974")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="text-left font-bold leading-snug hover:underline"
                        >
                          {government.primeMinister}
                        </button>
                        <span className="block font-mono text-[11px] text-muted">
                          {formatDate(government.start)} → {government.end ? formatDate(government.end) : "hoje"}
                        </span>
                      </span>
                      <span className="text-sm text-muted">
                        {government.support ?? government.parties.map((party) => party.acronym).join(" + ")}
                      </span>
                      <span className="flex flex-col items-start gap-1 md:items-end">
                        <span className="font-mono text-xs font-bold">{durationLabel(government.start, endOf(government, today))}</span>
                        <span aria-hidden="true" className="block h-1 w-full max-w-40 rounded-full bg-surface">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.max(2, (government.days / longest) * 100)}%`, backgroundColor: accentOf(government) }}
                          />
                        </span>
                        <EndBadge government={government} />
                      </span>
                    </article>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </section>
    </>
  );
}

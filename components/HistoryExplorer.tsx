"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { electionPath } from "@/lib/elections";
import { formatDate } from "@/lib/format";
import {
  accentOf,
  decadeTicks,
  durationLabel,
  END_LABELS,
  endOf,
  endTone,
  fillOf,
  groupsOf,
  REVOLUTION,
  spanOnAxis,
  timelineByDecade,
  TONE_COLOR,
  type HistoryGroup,
} from "@/lib/history";
import { partyColor } from "@/lib/parliament";
import type { HistoricalGovernment, TimelineEvent } from "@/lib/types";
import { HistoryPlayback, type HistoryParliament } from "./HistoryPlayback";
import { PartyLogo } from "./PartyLogo";

const FILTERS: { key: HistoryGroup | "all"; label: string; color: string | null }[] = [
  { key: "all", label: "Todos", color: null },
  { key: "ps", label: "Liderados pelo PS", color: partyColor("ps") },
  { key: "psd", label: "Liderados pelo PSD", color: partyColor("psd") },
  { key: "coalition", label: "Coligações", color: "var(--stage-debate)" },
  { key: "presidential", label: "Iniciativa presidencial", color: "var(--stage-president)" },
  { key: "provisional", label: "Provisórios", color: "var(--muted)" },
];

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

const MOTION = "(prefers-reduced-motion: reduce)";
const prefersReducedMotion = () => window.matchMedia(MOTION).matches;
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const presidentName = (title: string) => title.replace(/^Presidente da República:\s*/, "");

type Props = {
  /** Newest first. */
  governments: HistoricalGovernment[];
  presidents: TimelineEvent[];
  /** Legislativas and presidenciais, on the timeline. */
  elections: TimelineEvent[];
  parliaments: HistoryParliament[];
  today: string;
  /** Shown between the bar and the list. */
  children?: ReactNode;
};

/**
 * Every government since 1974. First an animation from the revolution to today; once it ends (or the reader skips it)
 * one bar sized by time, with the chosen government in detail and the one before and after a press away. Below, the
 * timeline by decade with the elections and Presidents, filtered by who led each government.
 */
export function HistoryExplorer({ governments, presidents, elections, parliaments, today, children }: Props) {
  const [filter, setFilter] = useState<HistoryGroup | "all">("all");
  const [selected, setSelected] = useState(governments[0]?.code ?? "");
  const [chosenMode, setMode] = useState<"playing" | "full" | null>(null);
  // Without motion, the full view straight away; the animation is a press away.
  const reduced = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
  const mode = chosenMode ?? (reduced ? "full" : "playing");
  const focusFull = useRef(false);
  const fullHeading = useRef<HTMLHeadingElement>(null);
  const ordered = [...governments].reverse();

  useEffect(() => {
    if (mode === "full" && focusFull.current) {
      focusFull.current = false;
      fullHeading.current?.focus();
    }
  }, [mode]);
  const onEnd = useCallback((byReader: boolean) => {
    focusFull.current = byReader;
    setMode("full");
  }, []);
  const matches = (government: HistoricalGovernment) => filter === "all" || groupsOf(government).includes(filter);
  const index = governments.findIndex((item) => item.code === selected);
  const current = governments[index] ?? governments[0]!;
  const entries = timelineByDecade(governments.filter(matches), filter === "all" ? [...elections, ...presidents] : []);
  const presidentAt = (day: string) => presidents.find((president) => president.date <= day && (president.endDate ?? "9999") > day) ?? null;
  const president = presidentAt(current.start);

  return (
    <>
      <section aria-labelledby="de-1974" className="rounded-2xl border border-line p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="de-1974" ref={fullHeading} tabIndex={-1} className="font-mono text-xs font-bold uppercase tracking-widest outline-none">
            De 1974 a hoje
          </h2>
          {mode === "playing" ? (
            <span className="font-mono text-[11px] text-muted">
              50 anos de democracia em pouco mais de um minuto. Arrasta para andar no tempo.
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setMode("playing")}
              className="rounded-lg border border-line px-3 py-1 font-mono text-xs font-bold hover:bg-surface"
            >
              ▶ Ver a animação outra vez
            </button>
          )}
        </div>
        {mode === "playing" ? (
          <HistoryPlayback
            governments={governments}
            presidents={presidents}
            elections={elections}
            parliaments={parliaments}
            today={today}
            onEnd={onEnd}
          />
        ) : (
          <>
            <p className="mb-3 font-mono text-[11px] text-muted">
              Cada bloco é um governo, do tamanho do tempo que durou. Carrega para ver.
            </p>
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
                  <p className="mt-2 font-mono text-[11px] text-muted">
                    Presidente da República quando tomou posse: {presidentName(president.title)}
                  </p>
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
          </>
        )}
      </section>

      {children}

      <section aria-labelledby="governo-a-governo" className="mt-12">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
          <h2 id="governo-a-governo" className="font-mono text-sm font-bold uppercase tracking-widest">
            Governo a governo
          </h2>
          <span className="font-mono text-[11px] text-muted">
            {filter === "all"
              ? `${governments.length} governos`
              : `${governments.filter(matches).length} de ${governments.length} governos`}
          </span>
        </div>
        <div role="group" aria-label="Mostrar" className="mb-6 flex flex-wrap gap-2">
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
        {entries.map((decade) => {
          const year = Math.floor(Number(decade.entries.at(-1)!.date.slice(0, 4)) / 10) * 10;
          return (
            <section key={decade.label} aria-labelledby={`decada-${decade.label}`} className="mb-8">
              <h3 id={`decada-${decade.label}`} className="mb-3 text-4xl font-bold tabular-nums">
                <span className="sr-only">Anos </span>
                {year}
              </h3>
              <ol>
                {decade.entries.map((entry, position) => {
                  const year = entry.date.slice(0, 4);
                  const showYear = position === 0 || decade.entries[position - 1]!.date.slice(0, 4) !== year;
                  return (
                    <li
                      key={
                        entry.kind === "government" ? entry.government.code : `${entry.event.kind}-${entry.event.date}-${entry.event.title}`
                      }
                      id={entry.kind === "government" ? entry.government.code : undefined}
                      className="grid scroll-mt-24 grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)]"
                    >
                      <span className="pt-3 font-mono text-xs font-bold text-muted">{showYear ? year : ""}</span>
                      <div className="relative border-l-2 border-line pb-4 pl-5">
                        {entry.kind === "government" ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="absolute -left-[7px] top-4 size-3 rounded-full ring-4 ring-paper"
                              style={{ background: accentOf(entry.government) }}
                            />
                            <GovernmentCard government={entry.government} today={today} />
                          </>
                        ) : (
                          <>
                            <span
                              aria-hidden="true"
                              className="absolute -left-[5px] top-[18px] size-2 rounded-full border-2 border-muted bg-paper"
                            />
                            <EventRow event={entry.event} />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </section>
    </>
  );
}

function GovernmentCard({ government, today }: { government: HistoricalGovernment; today: string }) {
  return (
    <article
      aria-labelledby={`${government.code}-nome`}
      className={`rounded-xl border border-l-4 border-line p-4 ${government.current ? "bg-surface" : ""}`}
      style={{ borderLeftColor: accentOf(government) }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-muted">{government.name}</p>
        <EndBadge government={government} />
      </div>
      <h4 id={`${government.code}-nome`} className="mt-1 text-xl font-bold leading-tight">
        {government.primeMinister}
      </h4>
      <p className="mt-1 font-mono text-xs text-muted">
        {formatDate(government.start)} → {government.end ? formatDate(government.end) : "hoje"} ·{" "}
        {durationLabel(government.start, endOf(government, today))}
      </p>
      {(government.parties.length > 0 || government.support) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {government.parties.map((party) => (
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
          {government.support && <span className="text-sm text-muted">{government.support}</span>}
        </div>
      )}
      {government.endNote && <p className="mt-2 text-sm leading-relaxed">{government.endNote}</p>}
      {(government.current || government.portalUrl) && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
          {government.current && (
            <Link href="/governo" className="font-bold text-link underline">
              Quem governa agora →
            </Link>
          )}
          {government.portalUrl && (
            <a href={government.portalUrl} className="text-link underline" target="_blank" rel="noopener noreferrer">
              No portal do Governo<span className="sr-only"> (abre noutra janela)</span>
            </a>
          )}
        </p>
      )}
    </article>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  const text = event.kind === "president" ? `${presidentName(event.title)} toma posse como Presidente da República` : event.title;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 pt-2.5 font-mono text-xs">
      <span className="text-muted">{formatDate(event.date)}</span>
      {event.electionId ? (
        <Link href={electionPath(event.electionId)} className="font-bold underline hover:text-link">
          {text} →
        </Link>
      ) : (
        <span className="font-bold">{text}</span>
      )}
      {event.detail && <span className="text-muted">{event.detail}</span>}
    </p>
  );
}

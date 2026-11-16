"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatLongDate } from "@/lib/format";
import { accentOf, decadeTicks, endOf, fillOf, REVOLUTION, spanOnAxis } from "@/lib/history";
import { partyColor } from "@/lib/parliament";
import type { HistoricalGovernment, TimelineEvent } from "@/lib/types";

/** A Parliament after a legislativas: the seats of each list that won any. */
export type HistoryParliament = {
  date: string;
  title: string;
  seats: { key: string; label: string; color: string; mandates: number }[];
};

type Props = {
  /** Newest first. */
  governments: HistoricalGovernment[];
  presidents: TimelineEvent[];
  elections: TimelineEvent[];
  parliaments: HistoryParliament[];
  today: string;
  /** The animation reached today, or the reader skipped to it. */
  onEnd: (byReader: boolean) => void;
};

/** Seconds from 1974 to today. */
const DURATION = 40;
const DAY = 86_400_000;
const NO_PARTY = "sem-partido";
const ROW = 30;

const dayNumber = (day: string) => Math.round(Date.parse(`${day.slice(0, 10)}T12:00:00Z`) / DAY);
const dayOf = (number: number) => new Date(number * DAY).toISOString().slice(0, 10);
const presidentName = (title: string) => title.replace(/^Presidente da República:\s*/, "");
const yearsFormat = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Happening = { date: string; text: string; color: string };

/**
 * Fifty years in forty seconds: the date runs from the revolution to today, and with it who governs, who is President,
 * the years each party has spent in government and, once the results exist, the seats in Parliament. A slider moves
 * through time; the reader can pause, start over, or skip to the end.
 */
export function HistoryPlayback({ governments, presidents, elections, parliaments, today, onEnd }: Props) {
  const first = dayNumber(REVOLUTION);
  const last = dayNumber(today);
  const [day, setDay] = useState(first);
  const [playing, setPlaying] = useState(true);
  const frame = useRef<number | null>(null);
  const ended = useRef(false);

  // Advance with the clock while playing; stop at today and hand over to the full view.
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(now - previous, 100);
      previous = now;
      setDay((current) => Math.min(last, current + ((last - first) * elapsed) / (DURATION * 1000)));
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing, first, last]);

  useEffect(() => {
    if (day >= last && !ended.current) {
      ended.current = true;
      setPlaying(false);
      onEnd(false);
    }
  }, [day, last, onEnd]);

  const ordered = useMemo(() => [...governments].reverse(), [governments]);
  const parties = useMemo(() => {
    const known = new Map<string, { key: string; label: string; color: string }>();
    for (const government of ordered) {
      for (const party of government.parties)
        known.set(party.slug, { key: party.slug, label: party.acronym, color: partyColor(party.slug) });
    }
    known.set(NO_PARTY, { key: NO_PARTY, label: "Sem partido", color: "var(--muted)" });
    return [...known.values()];
  }, [ordered]);

  const happenings = useMemo(() => {
    const list: Happening[] = [
      ...ordered.map((government) => ({
        date: government.start,
        text: `${government.name}: ${government.primeMinister}`,
        color: accentOf(government),
      })),
      ...elections.map((election) => ({ date: election.date, text: election.title, color: "var(--ink)" })),
      ...presidents.map((president) => ({
        date: president.date,
        text: `${presidentName(president.title)} toma posse como Presidente`,
        color: "var(--stage-president)",
      })),
    ];
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [ordered, elections, presidents]);

  const date = dayOf(Math.floor(day));
  const government = ordered.findLast((item) => item.start <= date) ?? ordered[0]!;
  const president = presidents.find((item) => item.date <= date && (item.endDate ?? "9999") > date) ?? null;
  const parliament = parliaments.findLast((item) => item.date <= date) ?? null;
  const recent = happenings
    .filter((item) => item.date <= date)
    .slice(-3)
    .reverse();
  const progress = ((day - first) / (last - first)) * 100;

  // Years each party has spent in government up to this day; partners in a coalition each count the whole time.
  const years = new Map<string, number>();
  for (const item of ordered) {
    if (item.start > date) break;
    const end = endOf(item, today) < date ? endOf(item, today) : date;
    const length = (dayNumber(end) - dayNumber(item.start)) / 365.25;
    const keys = item.parties.length > 0 ? item.parties.map((party) => party.slug) : [NO_PARTY];
    for (const key of keys) years.set(key, (years.get(key) ?? 0) + length);
  }
  const race = parties
    .map((party) => ({ ...party, years: years.get(party.key) ?? 0 }))
    .sort((a, b) => b.years - a.years || a.label.localeCompare(b.label));
  const mostYears = Math.max(race[0]?.years ?? 0, 1);
  const seatTotal = parliament?.seats.reduce((sum, item) => sum + item.mandates, 0) ?? 0;

  const seek = (value: number) => {
    setPlaying(false);
    ended.current = value >= last;
    setDay(value);
  };

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <p aria-hidden="true" className="font-mono text-6xl font-bold tabular-nums leading-none sm:text-7xl">
            {date.slice(0, 4)}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">{formatLongDate(date)}</p>

          <div className="mt-4 rounded-xl border border-l-4 border-line p-3" style={{ borderLeftColor: accentOf(government) }}>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">A governar · {government.name}</p>
            <p className="mt-0.5 text-xl font-bold leading-tight">{government.primeMinister}</p>
            <p className="mt-0.5 text-sm text-muted">
              {government.support ?? (government.parties.map((party) => party.acronym).join(" + ") || "Governo provisório")}
            </p>
          </div>
          {president && (
            <p className="mt-2 font-mono text-xs">
              <span className="text-muted">Presidente da República · </span>
              {presidentName(president.title)}
            </p>
          )}

          <ol aria-label="O que aconteceu por último" className="mt-4 space-y-1.5">
            {recent.map((item, position) => (
              <li
                key={`${item.date}-${item.text}`}
                className="flex items-baseline gap-2 text-sm transition-opacity"
                style={{ opacity: 1 - position * 0.3 }}
              >
                <span aria-hidden="true" className="size-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: item.color }} />
                <span className="font-mono text-[11px] text-muted">{item.date.slice(0, 4)}</span>
                <span className="min-w-0">{item.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest">Anos no governo</p>
            <p className="text-xs text-muted">Em coligação, cada partido conta o tempo todo.</p>
            <ul className="relative mt-2" style={{ height: race.length * ROW }}>
              {race.map((party, rank) => (
                <li
                  key={party.key}
                  className="absolute inset-x-0 flex items-center gap-2 transition-[top] duration-500"
                  style={{ top: rank * ROW, height: ROW - 6 }}
                >
                  <span className="w-24 shrink-0 truncate font-mono text-xs font-bold">{party.label}</span>
                  <span className="h-3 min-w-0 flex-1">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(party.years / mostYears) * 100}%`,
                        backgroundColor: party.color,
                        minWidth: party.years > 0 ? 3 : 0,
                      }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">{yearsFormat.format(party.years)} a</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest">Parlamento</p>
            {parliament ? (
              <>
                <p className="text-xs text-muted">Depois das {parliament.title}</p>
                <div aria-hidden="true" className="mt-2 flex h-5 overflow-hidden rounded-md">
                  {parliament.seats.map((item) => (
                    <span
                      key={item.key}
                      className="border-r border-paper transition-[width] duration-700 last:border-0"
                      style={{ width: `${(item.mandates / seatTotal) * 100}%`, backgroundColor: item.color }}
                    />
                  ))}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {parliament.seats.map((item) => (
                    <li key={item.key} className="flex items-center gap-1 font-mono text-[11px]">
                      <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: item.color }} />
                      {item.label} <b>{item.mandates}</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted">
                {parliaments.length > 0
                  ? `Os resultados das legislativas aparecem a partir de ${parliaments[0]!.date.slice(0, 4)}.`
                  : "Os resultados das legislativas ainda não estão disponíveis."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div aria-hidden="true" className="relative h-8 overflow-hidden rounded-md bg-surface">
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}>
            {ordered.map((item) => {
              const { left, width } = spanOnAxis(item.start, endOf(item, today), REVOLUTION, today);
              return (
                <span
                  key={item.code}
                  className="absolute inset-y-0 border-r border-paper"
                  style={{ left: `${left}%`, width: `${width}%`, background: fillOf(item) }}
                />
              );
            })}
          </div>
          <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${progress}% - 1px)` }} />
        </div>
        <label htmlFor="momento" className="sr-only">
          Data na animação
        </label>
        <input
          id="momento"
          type="range"
          min={first}
          max={last}
          step={1}
          value={Math.floor(day)}
          aria-valuetext={formatLongDate(date) ?? date}
          onChange={(event) => seek(Number(event.target.value))}
          className="mt-1 block w-full accent-[var(--ink)]"
        />
        <div aria-hidden="true" className="relative h-4">
          {decadeTicks(REVOLUTION, today).map((year) => {
            const { left } = spanOnAxis(`${year}-01-01`, `${year}-01-01`, REVOLUTION, today);
            return (
              <span key={year} className="absolute -translate-x-1/2 font-mono text-[11px] text-muted" style={{ left: `${left}%` }}>
                {year}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (day >= last) {
              ended.current = false;
              setDay(first);
            }
            setPlaying((value) => !value);
          }}
          className="rounded-lg bg-ink px-4 py-2 font-mono text-xs font-bold text-paper"
        >
          {playing ? "❚❚ Pausa" : "▶ Continuar"}
        </button>
        <button
          type="button"
          onClick={() => {
            ended.current = false;
            setDay(first);
            setPlaying(true);
          }}
          className="rounded-lg border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
        >
          ↺ Recomeçar
        </button>
        <button
          type="button"
          onClick={() => {
            ended.current = true;
            setPlaying(false);
            setDay(last);
            onEnd(true);
          }}
          className="ml-auto rounded-lg border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
        >
          Saltar para o fim ⏭
        </button>
      </div>
    </div>
  );
}

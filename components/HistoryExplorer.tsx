"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { electionPath } from "@/lib/elections";
import { formatDate } from "@/lib/format";
import {
  accentOf,
  durationLabel,
  END_LABELS,
  endOf,
  endTone,
  groupsOf,
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

/**
 * Scroll to an anchor on this page without adding a history entry: Next's router does not know entries made by plain
 * hash links, so Back from another page would change the URL and leave that page on screen.
 */
function jump(event: React.MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById(event.currentTarget.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: window.matchMedia(MOTION).matches ? "auto" : "smooth", block: "start" });
}

/** "Anos 2020", and "1974–79" for the first, which starts with the revolution. */
const decadeName = (year: number) => (year === 1970 ? "1974–79" : `Anos ${year}`);

/** 2020 for the decade of these entries. */
const decadeYear = (entries: readonly { date: string }[]) => Math.floor(Number(entries.at(-1)!.date.slice(0, 4)) / 10) * 10;

const MOTION = "(prefers-reduced-motion: reduce)";
const presidentName = (title: string) => title.replace(/^Presidente da República:\s*/, "");

type Props = {
  /** Newest first. */
  governments: HistoricalGovernment[];
  presidents: TimelineEvent[];
  /** Legislativas and presidenciais, on the timeline. */
  elections: TimelineEvent[];
  parliaments: HistoryParliament[];
  today: string;
  /** For each government's code, the legislatures it governed in, to open what happened then. */
  mandates?: Record<string, GovernmentMandate[]>;
  /** Shown between the bar and the list. */
  children?: ReactNode;
};

/**
 * Every government since 1974. First an animation from the revolution to today; once it ends (or the reader skips it)
 * one bar sized by time, with the chosen government in detail and the one before and after a press away. Below, the
 * timeline by decade with the elections and Presidents, filtered by who led each government.
 */
export type GovernmentMandate = { id: string; name: string; events: number };

export function HistoryExplorer({ governments, presidents, elections, parliaments, today, mandates = {}, children }: Props) {
  const [filter, setFilter] = useState<HistoryGroup | "all">("all");
  const matches = (government: HistoricalGovernment) => filter === "all" || groupsOf(government).includes(filter);
  const [active, setActive] = useState<string | null>(null);
  // The decade being read, for the rail beside the timeline.
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-decade]")];
    const observer = new IntersectionObserver(
      (changes) => {
        const seen = changes.filter((change) => change.isIntersecting).map((change) => (change.target as HTMLElement).dataset.decade!);
        if (seen[0]) setActive(seen[0]);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [filter]);
  const entries = timelineByDecade(governments.filter(matches), filter === "all" ? [...elections, ...presidents] : []);

  return (
    <>
      <section aria-labelledby="de-1974" className="scroll-mt-24 rounded-2xl border border-line p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="de-1974" className="font-mono text-xs font-bold uppercase tracking-widest">
            De 1974 a hoje
          </h2>
          <span className="font-mono text-[11px] text-muted">
            50 anos de democracia em pouco mais de um minuto. Arrasta ou carrega na barra para andar no tempo.
          </span>
        </div>
        <HistoryPlayback governments={governments} presidents={presidents} elections={elections} parliaments={parliaments} today={today} />
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            {entries.map((decade) => {
              const year = decadeYear(decade.entries);
              return (
                <section key={decade.label} aria-labelledby={`decada-${year}`} data-decade={year} className="mb-8">
                  <h3 id={`decada-${year}`} className="mb-3 scroll-mt-24 text-4xl font-bold tabular-nums">
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
                            entry.kind === "government"
                              ? entry.government.code
                              : `${entry.event.kind}-${entry.event.date}-${entry.event.title}`
                          }
                          id={entry.kind === "government" ? entry.government.code : undefined}
                          className="grid scroll-mt-24 grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)]"
                        >
                          <span
                            id={showYear ? `ano-${year}` : undefined}
                            className="scroll-mt-24 pt-3 font-mono text-xs font-bold text-muted"
                          >
                            {showYear ? year : ""}
                          </span>
                          <div className="relative border-l-2 border-line pb-4 pl-5">
                            {entry.kind === "government" ? (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="absolute -left-[7px] top-4 size-3 rounded-full ring-4 ring-paper"
                                  style={{ background: accentOf(entry.government) }}
                                />
                                <GovernmentCard government={entry.government} today={today} mandates={mandates[entry.government.code]} />
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
          </div>
          <nav
            aria-label="Ir para"
            className="sticky top-20 hidden max-h-[calc(100vh-6rem)] self-start overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-line p-3 no-scrollbar lg:block"
          >
            <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line px-1 pb-2">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest">Ir para</p>
              {active && (
                <p className="font-mono text-[11px] text-muted">
                  a ver: <span className="font-bold text-[var(--stage-debate)]">{decadeName(Number(active)).toLowerCase()}</span>
                </p>
              )}
            </div>
            <ol className="space-y-1">
              {entries.map((decade) => {
                const year = decadeYear(decade.entries);
                const inDecade = decade.entries.flatMap((entry) => (entry.kind === "government" ? [entry.government] : []));
                const current = active === String(year);
                return (
                  <li key={decade.label}>
                    <a
                      href={`#decada-${year}`}
                      onClick={jump}
                      aria-current={current ? "location" : undefined}
                      className={`block rounded-xl border-l-4 px-2.5 py-2 hover:bg-surface ${current ? "border-[var(--stage-debate)] bg-surface" : "border-transparent"}`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`text-xl font-bold leading-tight ${current ? "" : "text-ink/85"}`}>{decadeName(year)}</span>
                        <span className="font-mono text-[11px] text-muted">
                          {inDecade.length} {inDecade.length === 1 ? "governo" : "governos"}
                        </span>
                      </span>
                      <span aria-hidden="true" className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-line">
                        {[...inDecade].reverse().map((government) => (
                          <span
                            key={government.code}
                            className="border-r border-paper last:border-0"
                            style={{ flexGrow: Math.max(government.days, 30), backgroundColor: accentOf(government) }}
                          />
                        ))}
                      </span>
                    </a>
                    {current && inDecade.length > 0 && (
                      <ol className="my-1 ml-4 space-y-0.5 border-l border-line pl-2">
                        {inDecade.map((government) => (
                          <li key={government.code}>
                            <a
                              href={`#${government.code}`}
                              onClick={jump}
                              className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface"
                            >
                              <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: accentOf(government) }}
                              />
                              <span className="min-w-0 flex-1 truncate">{government.primeMinister}</span>
                              <span className="whitespace-nowrap font-mono text-[10px] text-muted">
                                {government.name.split(" ")[0]} · {government.start.slice(0, 4)}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ol>
            <a
              href="#de-1974"
              onClick={jump}
              className="mt-3 block rounded-xl border border-line px-3 py-2.5 text-center font-mono text-xs font-bold hover:bg-surface"
            >
              ↑ Voltar à cronologia
            </a>
          </nav>
        </div>
      </section>
    </>
  );
}

export function GovernmentCard({
  government,
  today,
  heading = "h4",
  mandates = [],
}: {
  government: HistoricalGovernment;
  today: string;
  mandates?: GovernmentMandate[];
  /** The level of the Prime Minister's name, to follow the page's own headings. */
  heading?: "h3" | "h4";
}) {
  const Heading = heading;
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
      <Heading id={`${government.code}-nome`} className="mt-1 text-xl font-bold leading-tight">
        {government.primeMinister}
      </Heading>
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
      {mandates.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label={`O que aconteceu no mandato de ${government.primeMinister}`}>
          {mandates.map((mandate) => (
            <li key={mandate.id}>
              <Link
                href={`/legislaturas/${encodeURIComponent(mandate.id)}#aconteceu`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface"
              >
                <span className="font-bold">
                  O que aconteceu <span className="font-normal text-muted">· {mandate.name}</span>
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {mandate.events > 0 ? `${mandate.events} ${mandate.events === 1 ? "acontecimento" : "acontecimentos"} · ` : ""}leis,
                  polémicas e casos →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
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

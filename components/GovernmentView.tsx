"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { getGovernmentMember } from "@/lib/api/client";
import { formatLongDate } from "@/lib/format";
import { durationLabel } from "@/lib/history";
import { toneColor, type StageTone } from "@/lib/initiatives";
import { partyColor } from "@/lib/parliament";
import type { Government, GovernmentMember, Party } from "@/lib/types";
import { GovernmentPortrait } from "./GovernmentPortrait";

type Props = {
  government: Government;
  parties: Party[];
  /** The member from the address (?membro=), if any; unknown ids are ignored. */
  initialMember: string | null;
  /** Today, as YYYY-MM-DD, for the time in office. */
  today: string;
};

/** A minister's place in the Council of Ministers, with the team that works with them. */
export type CouncilSeat = { member: GovernmentMember; area: string; ministry: string; secretaries: GovernmentMember[] };

/** Who sits in the Council of Ministers, in protocol order: the Prime Minister, then each minister with their secretaries of State. */
export function councilSeats(government: Government): CouncilSeat[] {
  const seats: CouncilSeat[] = [];
  const pm = government.primeMinister;
  if (pm) {
    const own = government.ministries.find((ministry) => ministry.minister?.id === pm.id);
    seats.push({ member: pm, area: own?.area ?? "primeiro-ministro", ministry: "Primeiro-Ministro", secretaries: own?.secretaries ?? [] });
  }
  for (const ministry of government.ministries) {
    if (ministry.minister?.kind === "minister") {
      seats.push({ member: ministry.minister, area: ministry.area, ministry: ministry.name, secretaries: ministry.secretaries });
    }
  }
  return seats;
}

const ABBREVIATIONS: Record<string, string> = {
  "negocios-estrangeiros": "NE",
  "assuntos-parlamentares": "AP",
  "administracao-interna": "MAI",
};
const SMALL_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "a", "o"]);

/** "FIN" for Finanças: a short badge for each ministry, with the usual initials where there are some. */
export function ministryBadge(area: string, name: string): string {
  if (ABBREVIATIONS[area]) return ABBREVIATIONS[area]!;
  const word = name.split(/[\s,]+/).find((item) => item && !SMALL_WORDS.has(item.toLowerCase())) ?? name;
  return word.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase();
}

const TONES: StageTone[] = ["submitted", "law", "debate", "president", "approved", "stopped"];
const tinted = (tone: StageTone, amount = 14) => ({
  color: toneColor(tone),
  backgroundColor: `color-mix(in srgb, ${toneColor(tone)} ${amount}%, transparent)`,
});
const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

type Filter = "all" | "ministers" | "secretaries";

/**
 * The Government at a glance: a few figures, the Prime Minister, a card per ministry with its team, and beside them a
 * card with whoever was pressed. Below, every member in one table that can be searched.
 */
export function GovernmentView({ government, parties, initialMember, today }: Props) {
  const seats = useMemo(() => councilSeats(government), [government]);
  const known = (id: string | null) =>
    id && seats.some((seat) => seat.member.id === id || seat.secretaries.some((s) => s.id === id)) ? id : null;
  const [chosen, setChosen] = useState<string | null>(() => known(initialMember));
  const panelRef = useRef<HTMLDivElement>(null);
  const partyOf = (slug: string | null) => (slug ? (parties.find((party) => party.slug === slug) ?? null) : null);

  function choose(id: string | null) {
    setChosen(id);
    // Keeps the choice in the address so it can be shared, without a history entry per click.
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("membro", id);
    else url.searchParams.delete("membro");
    window.history.replaceState(window.history.state, "", url);
    // On a phone the card is below the ministries, so bring it into view.
    if (id && !window.matchMedia("(min-width: 1280px)").matches) {
      // After the render that shows the card, which is hidden on a phone while nothing is chosen.
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  // The ministry that is lit: the member's own, or their minister's for a secretary of State.
  const seatIndex = seats.findIndex((item) => item.member.id === chosen || item.secretaries.some((s) => s.id === chosen));
  const seat = seatIndex >= 0 ? seats[seatIndex]! : null;
  const member = seat ? (seat.member.id === chosen ? seat.member : seat.secretaries.find((s) => s.id === chosen)!) : null;

  const pmSeat = seats[0]?.member.kind === "prime_minister" ? seats[0] : null;
  const ministerSeats = seats.filter((item) => item.member.kind === "minister");
  const secretaries = seats.reduce((sum, item) => sum + item.secretaries.length, 0);
  const council = seats.map((item) => item.member);
  const deputies = council.filter((item) => item.deputyId !== null || item.partySource === "deputy").length;
  const toneOf = (area: string) =>
    TONES[
      Math.max(
        0,
        ministerSeats.findIndex((item) => item.area === area),
      ) % TONES.length
    ]!;
  const empty = government.ministries.filter((ministry) => !ministry.minister);

  const stats = [
    { label: "no Conselho de Ministros", value: String(council.length), note: "o Primeiro-Ministro e os ministros" },
    { label: "secretários de Estado", value: String(secretaries), note: "trabalham com cada ministro" },
    {
      label: "foram eleitos deputados",
      value: `${deputies} de ${council.length}`,
      note: "dos membros do Conselho",
    },
    ...(government.startDate
      ? [{ label: "em funções", value: durationLabel(government.startDate, today), note: `desde ${formatLongDate(government.startDate)}` }]
      : []),
  ];

  return (
    <>
      <dl className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse justify-end rounded-2xl border border-line p-4">
            <dd className="mt-1 font-mono text-[11px] text-muted">{stat.note}</dd>
            <dt className="text-sm">{stat.label}</dt>
            <dd className="text-2xl font-bold tabular-nums sm:text-3xl">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {pmSeat && (
            <button
              type="button"
              onClick={() => choose(chosen === pmSeat.member.id ? null : pmSeat.member.id)}
              aria-pressed={seat === pmSeat}
              className={`mb-6 flex w-full items-center gap-4 rounded-2xl border p-4 text-left sm:p-5 ${
                seat === pmSeat ? "border-ink bg-surface" : "border-line hover:bg-surface"
              }`}
            >
              <GovernmentPortrait name={pmSeat.member.name} photoUrl={pmSeat.member.photoUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs uppercase tracking-widest text-muted">Primeiro-Ministro</span>
                <span className="block text-2xl font-bold leading-tight">{pmSeat.member.name}</span>
                {partyOf(pmSeat.member.partySlug) && <PartyTag party={partyOf(pmSeat.member.partySlug)!} member={pmSeat.member} />}
              </span>
              <span className="hidden font-mono text-xs font-bold sm:block" aria-hidden="true">
                Ver →
              </span>
            </button>
          )}

          <h2 className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
            Ministérios <span className="font-normal normal-case tracking-normal text-muted">· por ordem protocolar</span>
          </h2>
          <ul aria-label="Ministérios" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {ministerSeats.map((item) => {
              const tone = toneOf(item.area);
              const active = seat === item;
              return (
                <li key={item.area}>
                  <button
                    type="button"
                    onClick={() => choose(chosen === item.member.id ? null : item.member.id)}
                    aria-pressed={active}
                    className={`flex h-full w-full flex-col rounded-2xl border p-4 text-left ${
                      active ? "border-ink bg-surface" : "border-line hover:bg-surface"
                    }`}
                    style={active ? { boxShadow: `inset 0 3px 0 ${toneColor(tone)}` } : undefined}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-1.5 font-mono text-xs font-bold"
                        style={tinted(tone, 18)}
                      >
                        {ministryBadge(item.area, item.ministry)}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-mono text-[11px] uppercase leading-snug tracking-wider text-muted">
                          {item.ministry}
                        </span>
                        <span className="block font-bold leading-snug">{item.member.name}</span>
                      </span>
                    </span>
                    <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                      {item.secretaries.length > 0 ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden="true" className="flex -space-x-2">
                            {item.secretaries.slice(0, 4).map((secretary) => (
                              <span key={secretary.id} className="rounded-full ring-2 ring-paper">
                                <GovernmentPortrait name={secretary.name} photoUrl={secretary.photoUrl} size="sm" />
                              </span>
                            ))}
                          </span>
                          <span className="min-w-0 truncate font-mono text-[11px] text-muted">
                            {item.secretaries.length} {item.secretaries.length === 1 ? "secretário" : "secretários"}
                            <span className="hidden sm:inline"> · {item.secretaries.map((s) => firstName(s.name)).join(", ")}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-muted">Sem secretários de Estado</span>
                      )}
                      <span aria-hidden="true" className="shrink-0 font-mono text-[11px] font-bold" style={{ color: toneColor(tone) }}>
                        Ver equipa →
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {empty.length > 0 && (
            <p className="mt-3 font-mono text-xs text-muted">
              Sem ministro em funções: {empty.map((ministry) => ministry.name).join(", ")}.
            </p>
          )}
        </div>

        {/* On a phone the card sits below the ministries; the empty invitation is left out there. */}
        <div ref={panelRef} className={`scroll-mt-20 xl:block ${seat ? "" : "hidden"}`}>
          <div className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)]">
            {seat && member ? (
              <MemberCard
                key={member.id}
                member={member}
                seat={seat}
                order={seatIndex + 1}
                tone={seat === pmSeat ? "president" : toneOf(seat.area)}
                party={partyOf(member.partySlug)}
                onChoose={choose}
                onClose={() => choose(null)}
              />
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-muted">
                <p className="font-bold text-ink">Carrega num ministério</p>
                <p className="mt-1 text-sm">para ver quem o dirige, o que faz e quem trabalha com essa pessoa.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <MembersTable seats={seats} partyOf={partyOf} />
    </>
  );
}

/** One member: who they are, a short bio, and for a minister the secretaries of State who work with them. */
function MemberCard({
  member,
  seat,
  order,
  tone,
  party,
  onChoose,
  onClose,
}: {
  member: GovernmentMember;
  seat: CouncilSeat;
  /** The minister's place in protocol order, the Prime Minister first. */
  order: number;
  tone: StageTone;
  party: Party | null;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const detail = useQuery({ queryKey: ["government-member", member.id], queryFn: () => getGovernmentMember(member.id) });
  const secretary = member.kind === "secretary_of_state";
  const titleId = `membro-${member.id}`;

  return (
    <section
      aria-labelledby={titleId}
      className="flex max-h-[inherit] flex-col overflow-hidden rounded-2xl border border-t-4 border-line bg-paper"
      style={{ borderTopColor: toneColor(tone) }}
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs text-muted">
          {secretary ? (
            <button type="button" onClick={() => onChoose(seat.member.id)} className="hover:text-ink hover:underline">
              ← {seat.ministry}
            </button>
          ) : (
            <>
              <span className="rounded-full px-2 py-0.5 font-bold" style={tinted(tone)}>
                {seat.ministry}
              </span>
              <span>n.º {order} na ordem protocolar</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {/* Long content scrolls inside the card, so it never grows past the screen. */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mt-3 flex items-center gap-4">
          <GovernmentPortrait name={member.name} photoUrl={member.photoUrl} size="md" />
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold leading-tight">
              {member.name}
            </h2>
            <p className="text-sm text-muted">{member.title}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {member.startDate && (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">Em funções desde</dt>
              <dd className="font-bold">{formatLongDate(member.startDate)}</dd>
            </div>
          )}
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">Partido</dt>
            <dd className="font-bold">
              {party ? (
                <PartyTag party={party} member={member} />
              ) : member.independent ? (
                "Independente"
              ) : (
                <span className="font-normal text-muted">Não publicado</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-line pt-4 text-sm leading-relaxed">
          {detail.isPending ? (
            <p className="text-muted">A carregar a biografia…</p>
          ) : detail.isError || detail.data.bio.length === 0 ? (
            <p className="text-muted">Sem biografia publicada.</p>
          ) : (
            detail.data.bio.slice(0, 2).map((paragraph) => (
              <p key={paragraph} className="mb-2">
                {paragraph}
              </p>
            ))
          )}
          <Link href={`/governo/${member.id}`} className="font-mono text-sm text-link underline">
            Percurso e notícias →
          </Link>
        </div>

        {!secretary && seat.secretaries.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-1 border-b border-line pb-2 font-mono text-xs font-bold uppercase tracking-widest">
              A equipa{" "}
              <span className="font-normal normal-case tracking-normal text-muted">· {seat.secretaries.length} secretários de Estado</span>
            </h3>
            <ul>
              {seat.secretaries.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onChoose(item.id)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg p-2 text-left hover:bg-surface"
                  >
                    <GovernmentPortrait name={item.name} photoUrl={item.photoUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-snug">{item.name}</span>
                      <span className="block text-xs text-muted">{item.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "ministers", label: "Ministros" },
  { key: "secretaries", label: "Secretários de Estado" },
];

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Everyone in the Government in one table, searchable by name, post or ministry. */
function MembersTable({ seats, partyOf }: { seats: CouncilSeat[]; partyOf: (slug: string | null) => Party | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = seats.flatMap((seat) => [
    { member: seat.member, ministry: seat.ministry, minister: true },
    ...seat.secretaries.map((member) => ({ member, ministry: seat.ministry, minister: false })),
  ]);
  const counts = {
    all: rows.length,
    ministers: rows.filter((row) => row.minister).length,
    secretaries: rows.filter((row) => !row.minister).length,
  };
  const needle = fold(query.trim());
  const shown = rows.filter(
    (row) =>
      (filter === "all" || (filter === "ministers") === row.minister) &&
      (!needle || fold(`${row.member.name} ${row.member.title} ${row.ministry}`).includes(needle)),
  );

  return (
    <section aria-labelledby="todos-membros" className="mt-12">
      <h2 id="todos-membros" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
        Todos os membros do Governo
      </h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Procurar por nome, cargo ou ministério"
          aria-label="Procurar membro do Governo"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-sm sm:max-w-sm"
        />
        <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`h-9 rounded-full border px-3 font-mono text-xs font-bold ${
                filter === item.key ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
              }`}
            >
              {item.label} <span className="font-normal opacity-70">{counts[item.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Ninguém com esse nome ou cargo.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-normal">
                Nome e cargo
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-normal md:table-cell">
                Ministério
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Partido
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((row) => {
              const party = partyOf(row.member.partySlug);
              return (
                <tr key={row.member.id}>
                  <td className="py-2.5 pr-3">
                    <Link href={`/governo/${row.member.id}`} className="group flex items-center gap-3">
                      <GovernmentPortrait name={row.member.name} photoUrl={row.member.photoUrl} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-bold leading-snug group-hover:underline">{row.member.name}</span>
                        <span className="block text-xs text-muted">{row.member.title}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden py-2.5 pr-3 text-muted md:table-cell">{row.ministry}</td>
                  <td className="py-2.5 text-right font-mono text-xs">
                    {party ? (
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(party.slug) }} />
                        {party.acronym}
                      </span>
                    ) : row.member.independent ? (
                      <span>Independente</span>
                    ) : (
                      <span className="text-muted">
                        —<span className="sr-only">não publicado</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Their party, said as the source has it: elected for it, or a member of it. Unknown parties aren't shown. */
export function PartyTag({ party, member }: { party: Party; member: Pick<GovernmentMember, "gender" | "partySource"> }) {
  const elected = member.gender === "F" ? "Eleita deputada" : "Eleito deputado";
  return (
    <span className="mt-1 flex items-center gap-1.5 font-mono text-[11px] font-normal text-muted">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(party.slug) }} />
      {member.partySource === "deputy" ? `${elected} pelo ${party.acronym}` : `Militante do ${party.acronym}`}
    </span>
  );
}

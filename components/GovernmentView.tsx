"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { getGovernmentMember } from "@/lib/api/client";
import { formatLongDate } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import type { Government, GovernmentMember, Party } from "@/lib/types";
import { CouncilTable, type CouncilSeat } from "./CouncilTable";
import { GovernmentPortrait } from "./GovernmentPortrait";

type Props = {
  government: Government;
  parties: Party[];
  /** The member from the address (?membro=), if any; unknown ids are ignored. */
  initialMember: string | null;
  /** The page title, shown above the table so the card beside it starts level with it. */
  header?: ReactNode;
};

/** Who sits at the table: the Prime Minister, then each minister with their secretaries of State. */
export function councilSeats(government: Government): CouncilSeat[] {
  const seats: CouncilSeat[] = [];
  const pm = government.primeMinister;
  if (pm) {
    const own = government.ministries.find((ministry) => ministry.minister?.id === pm.id);
    seats.push({ member: pm, ministry: "Primeiro-Ministro", secretaries: own?.secretaries ?? [] });
  }
  for (const ministry of government.ministries) {
    if (ministry.minister?.kind === "minister") {
      seats.push({ member: ministry.minister, ministry: ministry.name, secretaries: ministry.secretaries });
    }
  }
  return seats;
}

/**
 * The Government laid out like the Parliament page: the Council of Ministers' table, and beside it a card with
 * whoever was pressed. Secretaries of State open from their minister's card.
 */
export function GovernmentView({ government, parties, initialMember, header }: Props) {
  const seats = councilSeats(government);
  const known = (id: string | null) =>
    id && seats.some((seat) => seat.member.id === id || seat.secretaries.some((s) => s.id === id)) ? id : null;
  const [chosen, setChosen] = useState<string | null>(() => known(initialMember));
  const panelRef = useRef<HTMLDivElement>(null);

  function choose(id: string | null) {
    setChosen(id);
    // Keeps the choice in the address so it can be shared, without a history entry per click.
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("membro", id);
    else url.searchParams.delete("membro");
    window.history.replaceState(window.history.state, "", url);
    // On a phone the card is below the table, so bring it into view.
    if (id && !window.matchMedia("(min-width: 1280px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // The seat at the table that is lit: the member's own, or their minister's for a secretary of State.
  const seat = seats.find((item) => item.member.id === chosen || item.secretaries.some((s) => s.id === chosen)) ?? null;
  const member = seat ? (seat.member.id === chosen ? seat.member : seat.secretaries.find((s) => s.id === chosen)!) : null;
  const partyOf = (slug: string | null) => (slug ? (parties.find((party) => party.slug === slug) ?? null) : null);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        {header}
        <p className="mb-4 font-mono text-xs text-muted">
          À mesa por ordem protocolar · <span className="hidden sm:inline">passa o cursor ou </span>toca numa pessoa
        </p>
        <CouncilTable seats={seats} chosen={seat?.member.id ?? null} onChoose={(id) => choose(chosen === id ? null : id)} />
        <p className="mx-auto mt-3 max-w-xl text-center text-xs text-muted">
          O Primeiro-Ministro à cabeceira e os ministros à volta, alternando à direita e à esquerda. Os pontos debaixo de cada nome são os
          seus secretários de Estado, que não se sentam no Conselho de Ministros.
        </p>
      </div>
      {/* On a large screen the card takes the height of the table column and scrolls inside, never growing past it. */}
      <div ref={panelRef} className="relative min-h-[28rem] scroll-mt-20 xl:min-h-0">
        <div className="h-full xl:absolute xl:inset-0">
          {seat && member ? (
            <MemberCard
              key={member.id}
              member={member}
              seat={seat}
              party={partyOf(member.partySlug)}
              onChoose={choose}
              onClose={() => choose(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-muted">
              <p className="font-bold text-ink">Carrega numa pessoa à mesa</p>
              <p className="mt-1 text-sm">para ver quem é, o que faz e quem trabalha com ela.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One member: who they are, a short bio, and for a minister the secretaries of State who work with them. */
function MemberCard({
  member,
  seat,
  party,
  onChoose,
  onClose,
}: {
  member: GovernmentMember;
  seat: CouncilSeat;
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
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-t-4 border-line border-t-ink bg-paper"
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-3">
        <div className="font-mono text-xs text-muted">
          {secretary ? (
            <button type="button" onClick={() => onChoose(seat.member.id)} className="hover:text-ink hover:underline">
              ← {seat.ministry}
            </button>
          ) : (
            seat.ministry
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-2 flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {/* Long content scrolls inside the card, so it never grows past the table beside it. */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mt-2 flex items-center gap-4">
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
              {party ? <PartyTag party={party} gender={member.gender} /> : <span className="font-normal text-muted">Não publicado</span>}
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
              Secretários de Estado <span className="font-normal text-muted">{seat.secretaries.length}</span>
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

/** Only for members who were elected deputies; otherwise their party isn't published. */
export function PartyTag({ party, gender }: { party: Party; gender: GovernmentMember["gender"] }) {
  return (
    <span className="mt-1 flex items-center gap-1.5 font-mono text-[11px] font-normal text-muted">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(party.slug) }} />
      {gender === "F" ? "Eleita deputada" : "Eleito deputado"} pelo {party.acronym}
    </span>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { COALITIONS, majority, partyColor, SEAT_ORDER } from "@/lib/parliament";
import type { DeputySummary, Parliament, ParliamentGroup, ParliamentSeat } from "@/lib/types";
import { DeputyPanel } from "./DeputyPanel";
import { DeputySearch } from "./DeputySearch";
import { Hemicycle } from "./Hemicycle";
import { OrgansExplainer } from "./OrgansExplainer";

export type Selection = { party: string; deputy: number | null } | null;

type Props = {
  parliament: Parliament;
  initialSelection: Selection;
  /** The page title, shown above the map so the card beside it starts level with it. */
  header?: ReactNode;
};

export function ParliamentView({ parliament, initialSelection, header }: Props) {
  const { deputies, groups, seatMap } = parliament;
  const groupBySlug = useMemo(() => new Map(groups.map((group) => [group.party.slug, group])), [groups]);
  const deputyById = useMemo(() => new Map(deputies.map((deputy) => [deputy.id, deputy])), [deputies]);

  const [selection, setSelection] = useState<Selection>(() => valid(initialSelection, groupBySlug, deputyById));
  const panelRef = useRef<HTMLDivElement>(null);

  const group = selection ? (groupBySlug.get(selection.party) ?? null) : null;
  const deputy = selection?.deputy ? (deputyById.get(selection.deputy) ?? null) : null;
  const bench = useMemo(() => (group ? deputies.filter((item) => item.partySlug === group.party.slug) : []), [deputies, group]);

  // The chosen party stands out.
  const highlighted = useMemo(() => (selection ? new Set([selection.party]) : null), [selection]);

  function choose(next: Selection) {
    setSelection(next);
    // Keeps the choice in the address so it can be shared, without a history entry per click.
    const url = new URL(window.location.href);
    url.searchParams.delete("partido");
    url.searchParams.delete("deputado");
    if (next?.deputy) url.searchParams.set("deputado", String(next.deputy));
    else if (next) url.searchParams.set("partido", next.party);
    window.history.replaceState(window.history.state, "", url);
    // On a phone the card is below the map, so bring it into view.
    if (next && !window.matchMedia("(min-width: 1280px)").matches) {
      // After the render that shows the card, which is hidden on a phone while nothing is chosen.
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const openSeat = (seat: ParliamentSeat) => {
    const sitting = seat.deputyId !== null ? deputyById.get(seat.deputyId) : undefined;
    choose({ party: seat.partySlug, deputy: sitting?.id ?? null });
  };
  const openDeputy = (id: number) => {
    const chosen = deputyById.get(id);
    if (chosen) choose({ party: chosen.partySlug ?? selection?.party ?? "", deputy: id });
  };

  const total = seatMap.seats.length;

  return (
    <>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {header}
          <p className="mb-4 font-mono text-xs text-muted">
            {total} deputados · maioria absoluta: {majority(total)} · <span className="hidden sm:inline">passa o cursor ou </span>toca num
            lugar
          </p>
          <Hemicycle
            seatMap={seatMap}
            groups={groupBySlug}
            deputies={deputyById}
            selectedSeat={deputy?.seat ?? null}
            highlighted={highlighted}
            onSeat={openSeat}
          />
          <Legend
            groups={groups}
            active={selection?.party ?? null}
            onPick={(slug) => choose(selection?.party === slug && !deputy ? null : { party: slug, deputy: null })}
          />
          <p className="mx-auto mt-3 max-w-xl text-center text-xs text-muted">
            Vista a partir da Mesa: cada partido no seu setor, da esquerda para a direita. Os lugares de cada partido são oficiais; quem se
            senta em cada cadeira é aproximado, porque o Parlamento não o publica: os deputados com cargos mais importantes vão à frente.
          </p>
        </div>
        {/* On a large screen the card takes the height of the map column and scrolls inside, never growing past it. On a
            phone, where it sits below the map, the empty invitation is left out: it would only be a blank box. */}
        <div className="flex flex-col gap-3">
          {/* A quicker way to someone than finding their seat: the card below opens on them. */}
          <DeputySearch deputies={deputies} groups={groupBySlug} onPick={openDeputy} />
          <div ref={panelRef} className={`relative min-h-[28rem] scroll-mt-20 xl:block xl:min-h-0 xl:flex-1 ${selection ? "" : "hidden"}`}>
            <div className="h-full xl:absolute xl:inset-0">
              <DeputyPanel
                group={group}
                deputies={bench}
                deputy={deputy}
                onDeputy={openDeputy}
                onBackToGroup={() => group && choose({ party: group.party.slug, deputy: null })}
                onClose={() => choose(null)}
              />
            </div>
          </div>
        </div>
      </div>

      <OrgansExplainer />

      <InitiativesLink counts={parliament.initiativeCounts} />
    </>
  );
}

/** The initiatives have their own page; here, how many there are and the way there. */
function InitiativesLink({ counts }: { counts: Parliament["initiativeCounts"] }) {
  const figures = [
    { label: "aprovadas", value: counts.approved },
    { label: "em discussão", value: counts.in_progress },
    { label: "rejeitadas", value: counts.rejected },
  ].filter((item) => item.value !== undefined);
  return (
    <section
      aria-labelledby="iniciativas"
      className="mt-10 rounded-2xl border border-line p-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
    >
      <div>
        <h2 id="iniciativas" className="text-xl font-bold">
          Iniciativas
        </h2>
        <p className="mt-1 text-sm text-muted">
          As leis e propostas que passam pelo Parlamento, explicadas em linguagem simples, com quem as propôs e como votou cada partido.
        </p>
        {figures.length > 0 && (
          <p className="mt-2 font-mono text-xs text-muted">
            {figures.map((item, index) => (
              <span key={item.label}>
                {index > 0 && " · "}
                <span className="font-bold text-ink">{item.value!.toLocaleString("pt-PT")}</span> {item.label}
              </span>
            ))}
          </p>
        )}
      </div>
      <Link
        href="/iniciativas"
        className="mt-4 inline-block shrink-0 rounded-full border border-ink px-4 py-2 font-mono text-sm font-bold hover:bg-surface sm:mt-0"
      >
        Ver as iniciativas →
      </Link>
    </section>
  );
}

/** Ignores an address that points at a party or deputy that isn't there. */
function valid(
  selection: Selection,
  groups: ReadonlyMap<string, ParliamentGroup>,
  deputies: ReadonlyMap<number, DeputySummary>,
): Selection {
  if (!selection) return null;
  if (selection.deputy !== null) {
    const deputy = deputies.get(selection.deputy);
    return deputy ? { party: deputy.partySlug ?? "", deputy: deputy.id } : null;
  }
  return groups.has(selection.party) ? { party: selection.party, deputy: null } : null;
}

const seatRank = (slug: string) => (SEAT_ORDER.includes(slug) ? SEAT_ORDER.indexOf(slug) : SEAT_ORDER.length);

/** One chip per party with its seats, left to right. Pressing one opens its bench. Coalition partners are grouped. */
function Legend({ groups, active, onPick }: { groups: ParliamentGroup[]; active: string | null; onPick: (slug: string) => void }) {
  const chip = (group: ParliamentGroup) => (
    <li key={group.party.slug}>
      <button
        type="button"
        aria-pressed={active === group.party.slug}
        onClick={() => onPick(group.party.slug)}
        title={group.party.name}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-bold ${
          active === group.party.slug ? "border-ink bg-surface" : "border-line hover:bg-surface"
        }`}
      >
        <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: partyColor(group.party.slug) }} />
        {group.party.acronym}
        <span className="font-normal text-muted">{group.seats}</span>
      </button>
    </li>
  );

  const items: ReactNode[] = [];
  const done = new Set<string>();
  // Same left-to-right order as the seats.
  const ordered = [...groups].sort((a, b) => seatRank(a.party.slug) - seatRank(b.party.slug));
  for (const group of ordered) {
    if (done.has(group.party.slug)) continue;
    const coalition = COALITIONS.find((item) => item.parties.includes(group.party.slug));
    const members = coalition ? ordered.filter((item) => coalition.parties.includes(item.party.slug)) : [];
    if (coalition && members.length > 1) {
      members.forEach((member) => done.add(member.party.slug));
      const seats = members.reduce((sum, member) => sum + member.seats, 0);
      items.push(
        <li
          key={coalition.acronym}
          className="flex flex-wrap items-center gap-1.5 rounded-full border border-dashed border-muted py-0.5 pl-2.5 pr-0.5"
        >
          <span className="font-mono text-xs text-muted" title={coalition.name}>
            {coalition.acronym} <span className="sr-only">({coalition.name})</span>
            {seats}
          </span>
          <ul className="flex gap-1">{members.map(chip)}</ul>
        </li>,
      );
    } else {
      done.add(group.party.slug);
      items.push(chip(group));
    }
  }

  return (
    <ul aria-label="Partidos no Parlamento" className="mt-4 flex flex-wrap justify-center gap-2">
      {items}
    </ul>
  );
}

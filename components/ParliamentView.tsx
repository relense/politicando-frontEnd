"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { COALITIONS, majority, partyColor, SEAT_ORDER } from "@/lib/parliament";
import type { DeputySummary, GovernmentMember, InitiativePage, Parliament, ParliamentGroup, ParliamentSeat } from "@/lib/types";
import { DeputyPanel } from "./DeputyPanel";
import { Hemicycle } from "./Hemicycle";
import { OrgansExplainer } from "./OrgansExplainer";
import { InitiativesSection, type InitiativeFilter } from "./InitiativesSection";

export type Selection = { party: string; deputy: number | null } | null;

type Props = {
  parliament: Parliament;
  initialInitiatives: InitiativePage | null;
  initialSelection: Selection;
  /** The page title, shown above the map so the card beside it starts level with it. */
  header?: ReactNode;
  /** The Prime Minister and ministers, in protocol order, for the Government's bench on the map. */
  government?: GovernmentMember[];
};

export function ParliamentView({ parliament, initialInitiatives, initialSelection, header, government = [] }: Props) {
  const { deputies, groups, seatMap } = parliament;
  const groupBySlug = useMemo(() => new Map(groups.map((group) => [group.party.slug, group])), [groups]);
  const deputyById = useMemo(() => new Map(deputies.map((deputy) => [deputy.id, deputy])), [deputies]);

  const [selection, setSelection] = useState<Selection>(() => valid(initialSelection, groupBySlug, deputyById));
  const [initiativeParties, setInitiativeParties] = useState<string[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const group = selection ? (groupBySlug.get(selection.party) ?? null) : null;
  const deputy = selection?.deputy ? (deputyById.get(selection.deputy) ?? null) : null;
  const bench = useMemo(() => (group ? deputies.filter((item) => item.partySlug === group.party.slug) : []), [deputies, group]);

  // The chosen party stands out; hovering an initiative shows its authors instead.
  const highlighted = useMemo(() => {
    if (initiativeParties) return new Set(initiativeParties);
    return selection ? new Set([selection.party]) : null;
  }, [initiativeParties, selection]);

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
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const filter: InitiativeFilter = deputy
    ? { label: deputy.name, deputy: deputy.id }
    : group
      ? { label: `${group.party.acronym}`, party: group.party.slug }
      : null;
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
            government={government}
          />
          <Legend
            groups={groups}
            active={selection?.party ?? null}
            onPick={(slug) => choose(selection?.party === slug && !deputy ? null : { party: slug, deputy: null })}
          />
          <p className="mx-auto mt-3 max-w-xl text-center text-xs text-muted">
            Vista a partir da Mesa: cada partido no seu setor, da esquerda para a direita.{" "}
            {government.length > 0 &&
              "Ao centro, a bancada do Governo, virada para os deputados; não são deputados e a disposição é esquemática. "}{" "}
            Os lugares de cada partido são oficiais; quem se senta em cada cadeira é aproximado, porque o Parlamento não o publica: os
            deputados com cargos mais importantes vão à frente.
          </p>
        </div>
        {/* On a large screen the card takes the height of the map column and scrolls inside, never growing past it. */}
        <div ref={panelRef} className="relative min-h-[28rem] scroll-mt-20 xl:min-h-0">
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

      <OrgansExplainer />

      <InitiativesSection
        initialPage={initialInitiatives}
        counts={parliament.initiativeCounts}
        groups={groupBySlug}
        filter={filter}
        onHighlight={setInitiativeParties}
      />
    </>
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

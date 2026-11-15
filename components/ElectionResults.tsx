import Link from "next/link";
import { formatNumber, formatPercent } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { partyPath } from "@/lib/parties";
import type { ElectionList, Party } from "@/lib/types";

/** How many lists show before the rest fold away. */
const SHOWN = 8;

const colorOf = (item: ElectionList) => (item.partySlugs[0] ? partyColor(item.partySlugs[0]) : "var(--muted)");

const bare = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();

/**
 * Our name for a list that is exactly one of our parties (same acronym on the ballot); the ballot's name for
 * coalitions such as CDU (PCP-PEV), even when only one of their parties is ours.
 */
export function listName(item: ElectionList, parties: Party[]): string {
  if (item.partySlugs.length === 1 && !item.coalition) {
    const party = parties.find((candidate) => candidate.slug === item.partySlugs[0]);
    if (party && bare(party.acronym) === bare(item.list)) return party.name;
  }
  return item.name;
}

/** Every list, most votes first: a bar for its share of valid votes, its votes, and its seats where there are seats. */
export function ElectionResults({ lists, parties, withMandates }: { lists: ElectionList[]; parties: Party[]; withMandates: boolean }) {
  if (lists.length === 0) return <p className="text-muted">Sem resultados para este local.</p>;
  const top = Math.max(...lists.map((item) => item.validPct ?? 0), 1);
  const row = (item: ElectionList) => (
    <li key={`${item.list}-${item.name}`} className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(item) }} />
          <span className="font-bold leading-snug">{listName(item, parties)}</span>
          {item.partySlugs.length > 0 && (
            <span className="flex gap-1 font-mono text-[11px] text-muted">
              {item.partySlugs.map((slug) => {
                const party = parties.find((candidate) => candidate.slug === slug);
                return party ? (
                  <Link key={slug} href={partyPath(slug)} className="hover:text-ink hover:underline">
                    {party.acronym}
                  </Link>
                ) : null;
              })}
            </span>
          )}
          {item.citizens && <span className="font-mono text-[11px] text-muted">movimento de cidadãos</span>}
        </span>
        <span className="flex items-baseline gap-3 font-mono text-sm">
          {withMandates && item.mandates !== null && item.mandates > 0 && (
            <span className="font-bold">
              {item.mandates} {item.mandates === 1 ? "mandato" : "mandatos"}
            </span>
          )}
          <span className="font-bold">{formatPercent(item.validPct)}</span>
          <span className="text-xs text-muted">{formatNumber(item.votes)} votos</span>
        </span>
      </div>
      <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full" style={{ width: `${((item.validPct ?? 0) / top) * 100}%`, backgroundColor: colorOf(item) }} />
      </div>
    </li>
  );

  return (
    <div>
      <ol className="divide-y divide-line">{lists.slice(0, SHOWN).map(row)}</ol>
      {lists.length > SHOWN && (
        <details className="group">
          <summary className="cursor-pointer py-2 font-mono text-sm text-link underline">
            <span className="group-open:hidden">Mostrar as outras {lists.length - SHOWN} listas</span>
            <span className="hidden group-open:inline">Esconder</span>
          </summary>
          <ol start={SHOWN + 1} className="divide-y divide-line">
            {lists.slice(SHOWN).map(row)}
          </ol>
        </details>
      )}
    </div>
  );
}

/** The seats won, one block per list in order, so a majority is visible at a glance. */
export function MandatesBar({ lists, total, parties }: { lists: ElectionList[]; total: number; parties: Party[] }) {
  const winners = lists.filter((item) => (item.mandates ?? 0) > 0);
  if (winners.length === 0) return null;
  const majority = Math.floor(total / 2) + 1;
  return (
    <figure>
      <div className="relative flex h-6 overflow-hidden rounded-md bg-surface">
        {winners.map((item) => (
          <div
            key={`${item.list}-${item.name}`}
            title={`${listName(item, parties)}: ${item.mandates}`}
            className="h-full border-r border-paper last:border-r-0"
            style={{ width: `${((item.mandates ?? 0) / total) * 100}%`, backgroundColor: colorOf(item) }}
          />
        ))}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 border-l-2 border-dashed border-ink"
          style={{ left: `${(majority / total) * 100}%` }}
        />
      </div>
      <figcaption className="mt-1.5 font-mono text-xs text-muted">
        {total} mandatos · maioria absoluta: {majority} (linha tracejada)
      </figcaption>
    </figure>
  );
}

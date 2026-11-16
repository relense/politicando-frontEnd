"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getPartyVotes, type PartyVoteFilter, type PartyVotePosition, type PartyVoteSummary } from "@/lib/api/partyVotes";
import { formatDate, formatNumber } from "@/lib/format";
import { headlineOf, initiativePath } from "@/lib/initiatives";

const POSITIONS = {
  favor: { label: "A favor", short: "A favor", mark: "✓" },
  against: { label: "Contra", short: "Contra", mark: "×" },
  abstention: { label: "Abstenção", short: "Abst.", mark: "–" },
} as const;

export function PositionBadge({ position, compact = false }: { position: PartyVotePosition; compact?: boolean }) {
  const { label, short, mark } = POSITIONS[position];
  const style =
    position === "favor" ? "border-ink" : position === "against" ? "border-ink bg-ink text-paper" : "border-dashed border-muted";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${style}`}
    >
      <span aria-hidden="true">{mark}</span>
      {compact ? short : label}
    </span>
  );
}

type Props = {
  slug: string;
  acronym: string;
  /** The totals, for the counts on the filters; the filters show without counts when missing. */
  summary?: PartyVoteSummary | null;
  /** A few of the latest, for the side panel. */
  compact?: boolean;
};

const PAGE = 20;

/**
 * How the party's group voted, newest first, with filters by position. The Parliament records votes by group, so this
 * is the group's position; when part of it voted otherwise, it says so.
 */
export function PartyVotes({ slug, acronym, summary, compact = false }: Props) {
  const [filter, setFilter] = useState<PartyVoteFilter | null>(null);
  const limit = compact ? 3 : PAGE;
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["party-votes", slug, filter, limit],
    queryFn: ({ pageParam }) => getPartyVotes(slug, { filter, page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });

  const filters: { key: PartyVoteFilter | null; label: string; count: number | null }[] = [
    { key: null, label: "Todas", count: summary?.total ?? null },
    { key: "favor", label: "A favor", count: summary?.favor ?? null },
    { key: "against", label: "Contra", count: summary?.against ?? null },
    { key: "abstention", label: "Abstenção", count: summary?.abstention ?? null },
    { key: "split", label: "Bancada dividida", count: summary?.split ?? null },
  ];

  const votes = data?.pages.flatMap((page) => page.votes) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <>
      {!compact && (
        <div role="group" aria-label="Filtrar por sentido de voto" className="mb-4 flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`h-9 rounded-full border px-3 font-mono text-xs font-bold ${
                filter === item.key ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
              }`}
            >
              {item.label}
              {item.count !== null && <span className="ml-1 font-normal opacity-70">{formatNumber(item.count)}</span>}
            </button>
          ))}
        </div>
      )}

      {isPending ? (
        <p className="text-sm text-muted">A carregar votações…</p>
      ) : isError ? (
        <p className="text-sm text-muted">Não foi possível carregar as votações.</p>
      ) : votes.length === 0 ? (
        <p className="text-sm text-muted">
          {filter ? "Nenhuma votação com este filtro." : `Sem votações registadas do ${acronym} nesta legislatura.`}
        </p>
      ) : (
        <>
          {!compact && (
            <p className="mb-1 font-mono text-xs text-muted">
              {formatNumber(total)} {total === 1 ? "votação" : "votações"} · mais recentes primeiro
            </p>
          )}
          <ul aria-label={`Votações do ${acronym}`} className="divide-y divide-line">
            {votes.map((vote) => (
              <li key={`${vote.vote.id}-${vote.initiative.id}`} className="flex items-start justify-between gap-3 py-3">
                <span className="min-w-0">
                  {!compact && (
                    <span className="block font-mono text-[11px] text-muted">
                      {[
                        vote.initiative.type,
                        formatDate(vote.vote.date),
                        vote.vote.phase,
                        vote.vote.result,
                        vote.basis === "unanimous" ? "unanimidade" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  <Link
                    href={initiativePath(vote.initiative.id)}
                    className={`block leading-snug hover:underline ${compact ? "line-clamp-3 text-sm" : "font-bold"}`}
                  >
                    {headlineOf(vote.initiative)}
                  </Link>
                  {!compact && vote.split && (
                    <span className="mt-1 block font-mono text-[11px] text-muted">Parte da bancada votou de outra forma.</span>
                  )}
                </span>
                {vote.position ? (
                  <PositionBadge position={vote.position} compact={compact} />
                ) : (
                  <span className="shrink-0 font-mono text-[11px] text-muted">Sem registo</span>
                )}
              </li>
            ))}
          </ul>
          {!compact && hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-4 rounded-full border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
            >
              {isFetchingNextPage ? "A carregar…" : `Carregar mais ${PAGE}`}
            </button>
          )}
        </>
      )}
    </>
  );
}

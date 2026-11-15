"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getDeputyVotes } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { DeputyVote } from "@/lib/types";

const POSITIONS = {
  favor: { label: "A favor", short: "A favor", mark: "✓" },
  against: { label: "Contra", short: "Contra", mark: "×" },
  abstention: { label: "Abstenção", short: "Abst.", mark: "–" },
} as const;

/** A vote that shows the party's position: the whole group voted this way, or everyone did. */
const isPartyVote = (vote: DeputyVote) => vote.position !== null && (vote.basis === "group" || vote.basis === "unanimous");

export function PositionBadge({ position, compact = false }: { position: NonNullable<DeputyVote["position"]>; compact?: boolean }) {
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
  /** A deputy of the party: the Parliament records votes by group, so their record gives the party's. */
  deputyId: number;
  acronym: string;
  compact?: boolean;
};

/** How the party voted, newest first. Votes where its deputies split are left out, since the party had no single position. */
export function PartyVotes({ deputyId, acronym, compact = false }: Props) {
  const limit = compact ? 8 : 30;
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["deputy-votes", deputyId, limit],
    queryFn: ({ pageParam }) => getDeputyVotes(deputyId, { cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (isPending) return <p className="text-sm text-muted">A carregar votações…</p>;
  if (isError) return <p className="text-sm text-muted">Não foi possível carregar as votações.</p>;
  const votes = data.pages.flatMap((page) => page.votes).filter(isPartyVote);
  const shown = compact ? votes.slice(0, 3) : votes;
  if (shown.length === 0) return <p className="text-sm text-muted">Sem votações registadas do {acronym} nesta legislatura.</p>;

  return (
    <>
      <ul className="divide-y divide-line">
        {shown.map((vote) => (
          <li key={vote.vote.id} className="flex items-start justify-between gap-3 py-3">
            <span className="min-w-0">
              {!compact && (
                <span className="block font-mono text-[11px] text-muted">
                  {[vote.initiative.type, formatDate(vote.vote.date), vote.basis === "unanimous" ? "unanimidade" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
              <span className={`block leading-snug ${compact ? "line-clamp-3 text-sm" : "font-bold"}`}>{vote.initiative.title}</span>
            </span>
            <PositionBadge position={vote.position!} compact={compact} />
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
          {isFetchingNextPage ? "A carregar…" : "Mostrar mais"}
        </button>
      )}
    </>
  );
}

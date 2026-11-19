"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getBudgetProposals, type BudgetProposalPage, type BudgetQuery } from "@/lib/api/budget";
import { ProposalItem } from "./ProposalItem";

/** The filtered proposals, from the page the server rendered, with «Carregar mais» for the next ones. */
export function ProposalList({
  year,
  query,
  initialPage,
  today,
}: {
  year: number;
  query: Omit<BudgetQuery, "cursor">;
  initialPage: BudgetProposalPage;
  today: string | null;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError } = useInfiniteQuery({
    queryKey: ["budget", year, "proposals", query],
    queryFn: ({ pageParam }) => getBudgetProposals(year, { ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
  });
  const items = data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Não há propostas com estes filtros.</p>;
  }
  return (
    <>
      <ul aria-label="Propostas de alteração" className="flex flex-col">
        {items.map((proposal) => (
          <li key={proposal.id}>
            <ProposalItem proposal={proposal} today={today} />
          </li>
        ))}
      </ul>
      {isError && (
        <p role="alert" className="mt-4 text-sm text-muted">
          Não foi possível carregar mais propostas.
        </p>
      )}
      {hasNextPage && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg border border-line px-5 py-2 font-mono text-sm font-bold hover:bg-surface disabled:opacity-60"
          >
            {isFetchingNextPage ? "A carregar…" : `Carregar mais ${query.limit ?? 20}`}
          </button>
        </div>
      )}
    </>
  );
}

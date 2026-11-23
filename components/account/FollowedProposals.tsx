"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { SignedOut } from "@/components/account/AccountSettings";
import { FollowButton } from "@/components/account/FollowButton";
import { ResultBadge } from "@/components/budget/BudgetParts";
import { PlannedLine, ProposalMeta, proposalPath } from "@/components/budget/ProposalItem";
import { useReader } from "@/lib/account";
import { getFollowedBudgetProposals } from "@/lib/api/budget";
import { lisbonDay } from "@/lib/format";

/** «A seguir»: the Budget proposals this account follows, newest followed first; each vote on them reaches the inbox. */
export function FollowedProposals() {
  const reader = useReader();
  if (reader === undefined) return <p className="text-muted">A verificar a sessão…</p>;
  if (!reader) return <SignedOut title="A seguir" text="Entra para veres as propostas do Orçamento que segues." path="/conta/seguir" />;
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">A seguir</h1>
      <p className="mt-1 text-sm text-muted">As propostas do Orçamento que segues. Cada votação chega às tuas notificações.</p>
      <List />
    </div>
  );
}

function List() {
  const today = lisbonDay(new Date().toISOString());
  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["followed-budget-proposals"],
    queryFn: ({ pageParam }) => getFollowedBudgetProposals(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  if (isPending) return <p className="mt-6 text-muted">A carregar…</p>;
  if (isError)
    return (
      <p role="alert" className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
        Não foi possível carregar. Tenta daqui a pouco.
      </p>
    );
  const items = data.pages.flatMap((page) => page.items);
  if (items.length === 0)
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
        Ainda não segues nenhuma proposta.{" "}
        <Link href="/orcamento#propostas" className="font-bold text-ink underline">
          Ver as propostas do Orçamento
        </Link>
      </p>
    );
  return (
    <>
      <ul aria-label="Propostas que segues" className="mt-6 flex flex-col">
        {items.map((proposal) => (
          <li key={proposal.id} className="flex items-start justify-between gap-3 border-b border-line py-3">
            <div className="min-w-0">
              <ProposalMeta proposal={proposal} today={today} />
              <Link
                href={proposalPath(proposal)}
                className="mt-0.5 block font-serif text-lg font-bold leading-snug hover:underline [overflow-wrap:anywhere]"
              >
                {proposal.title}
              </Link>
              <PlannedLine proposal={proposal} today={today} className="mt-0.5" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <ResultBadge result={proposal.result} />
              <FollowButton kind="budget_proposal" id={proposal.id} />
            </div>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-4 rounded-full border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
        >
          {isFetchingNextPage ? "A carregar…" : "Carregar mais"}
        </button>
      )}
    </>
  );
}

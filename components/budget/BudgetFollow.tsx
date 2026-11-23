"use client";

import { FollowButton } from "@/components/account/FollowButton";
import { useExtras } from "@/lib/accountExtras";
import type { BudgetProposal } from "@/lib/api/budget";

/**
 * «Seguir esta proposta»: each vote on it reaches the inbox (backend docs/engagement-api.md, budget_vote). Offered
 * while it's still to be voted; once voted there's nothing left to tell, so only a reader already following sees it,
 * to stop.
 */
export function BudgetFollow({ proposal, large = false }: { proposal: Pick<BudgetProposal, "id" | "result">; large?: boolean }) {
  const following = useExtras().follows.budget_proposal.includes(proposal.id);
  const open = proposal.result === "pending" || proposal.result === "sent_to_plenary";
  if (!open && !following) return null;
  return <FollowButton kind="budget_proposal" id={proposal.id} large={large} />;
}

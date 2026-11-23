import { beforeEach, describe, expect, it } from "vitest";
import { applyAccountState } from "@/lib/account";
import { currentExtras } from "@/lib/accountExtras";
import { accountStateSchema } from "@/lib/api/account";
import { notificationSchema } from "@/lib/api/engagement";
import { notificationHref, notificationText, tabOf } from "@/lib/notifications";

// "Seguir" a Budget proposal: each vote on it in the inbox (backend docs/engagement-api.md, budget_vote).
const vote = (budgetProposal: unknown) =>
  notificationSchema.parse({
    id: 9,
    kind: "budget_vote",
    actorName: null,
    count: 1,
    createdAt: "2026-11-23T12:00:00.000Z",
    read: false,
    snippet: null,
    link: { budgetProposalId: 25391, budgetYear: 2027 },
    threadTitle: null,
    board: null,
    headline: null,
    prediction: null,
    budgetProposal,
  });

describe("following a Budget proposal", () => {
  beforeEach(() => window.localStorage.clear());

  it("a vote reads as the result, where, the official title and its number; and leads to the proposal's page", () => {
    const item = vote({
      number: "1C-1",
      title: "N.º 5, Artigo 91.º",
      votedOn: "2026-11-23",
      phase: "committee",
      result: "approved",
      partLabel: null,
    });
    expect(notificationText(item)).toEqual({ actor: null, lead: "Aprovada em comissão: N.º 5, Artigo 91.º (1C-1)", quote: null });
    expect(notificationHref(item)).toBe("/orcamento/2027/proposta/25391");
    expect(tabOf(item)).toBe("seguir");
  });

  it("voted in parts: one line per part, naming it; in the plenary; rejected or prejudicada; an unknown result still reads", () => {
    const base = { number: "1C-1", title: "N.º 5, Artigo 91.º", votedOn: "2026-11-23" };
    expect(notificationText(vote({ ...base, phase: "plenary", result: "rejected", partLabel: "alínea a)" })).lead).toBe(
      "Rejeitada em plenário: N.º 5, Artigo 91.º (1C-1), alínea a)",
    );
    expect(notificationText(vote({ ...base, phase: null, result: "superseded", partLabel: null })).lead).toBe(
      "Prejudicada: N.º 5, Artigo 91.º (1C-1)",
    );
    expect(notificationText(vote({ ...base, phase: "committee", result: null, partLabel: null })).lead).toBe(
      "Votada em comissão: N.º 5, Artigo 91.º (1C-1)",
    );
  });

  it("an older API (no budgetProposal, no link fields) still reads, and other kinds are untouched", () => {
    const item = vote(undefined);
    expect(item.budgetProposal).toBeNull();
    expect(notificationText(item).lead).toBe("Uma proposta do Orçamento que segues foi votada");
    expect(notificationHref(item)).toBe("/orcamento/2027/proposta/25391");
    const old = notificationSchema.parse({
      id: 1,
      kind: "story_update",
      count: 1,
      createdAt: "2026-11-23T12:00:00.000Z",
      link: { storyId: 4 },
    });
    expect(old.link.budgetProposalId).toBeNull();
  });

  it("the followed proposals come with the account's state; an older API sends none", () => {
    const state = accountStateSchema.parse({ follows: { stories: [41], threads: [17], budgetProposals: [25391, 28336] } });
    applyAccountState(state);
    expect(currentExtras().follows).toEqual({ story: [41], thread: [17], budget_proposal: [25391, 28336] });
    expect(accountStateSchema.parse({ follows: { stories: [], threads: [] } }).follows.budgetProposals).toEqual([]);
  });
});

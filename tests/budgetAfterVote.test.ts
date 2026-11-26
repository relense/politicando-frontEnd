import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBudgetProposal, getBudgetProposals, getBudgets, getBudgetSummary, mapBudgetProposal } from "@/lib/api/budget";
import { implementationLabel, notAppliedCount } from "@/lib/budget";
import { budgetFilters, budgetPath, queryOf } from "@/lib/budgetFilters";
import { handlers } from "@/mocks/handlers";

// After the vote (backend docs/budget-api.md, "After the vote"): what the Government announced about approved proposals,
// recorded by hand by the team, always dated and with a source.
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

const raw = async (id = 28304) => (await fetch(`http://localhost/api/v2/budget/2027/proposals/${id}`)).json();

describe("the year's notes after the vote", () => {
  it("come on the summary and on each year of the list, newest first; [] when none", async () => {
    const summary = await getBudgetSummary(2027);
    expect(summary?.afterVote).toEqual([
      {
        date: "2026-11-26",
        text: expect.stringContaining("não vai aplicar"),
        sourceName: "Jornal de Exemplo",
        sourceUrl: "https://exemplo.pt/governo-normas-orcamento",
        proposalIds: [28304],
      },
    ]);
    const budgets = await getBudgets();
    expect(budgets?.items[0]!.afterVote).toHaveLength(1);
    expect(budgets?.items[1]!.afterVote).toEqual([]);
  });

  it("an older API, a broken note or one without its source: left out, never a broken page", async () => {
    const { parseAfterVote } = await import("@/lib/api/budget");
    expect(parseAfterVote(undefined)).toEqual([]);
    expect(parseAfterVote("x")).toEqual([]);
    const note = { date: "2026-11-26", text: "Disse.", sourceName: "Jornal", sourceUrl: "javascript:alert(1)", proposalIds: [1] };
    expect(parseAfterVote([note, { ...note, sourceName: "" }, { ...note, text: " " }, { text: "sem data" }])).toEqual([
      { ...note, sourceUrl: null },
    ]);
    expect(parseAfterVote([{ ...note, proposalIds: undefined }])[0]!.proposalIds).toEqual([]);
  });
});

describe("a proposal's implementation", () => {
  it("is read on the list and on the single proposal; null when nothing is known", async () => {
    expect((await getBudgetProposal(2027, 28304))?.implementation).toEqual({
      status: "not_applied",
      date: "2026-11-26",
      note: "O Governo invoca a lei-travão.",
      sourceName: "Jornal de Exemplo",
      sourceUrl: "https://exemplo.pt/governo-normas-orcamento",
    });
    expect((await getBudgetProposal(2027, 28301))?.implementation).toBeNull();
    const page = await getBudgetProposals(2027, { implementation: "not_applied" });
    expect(page.items.map((item) => item.id)).toEqual([28304]);
    expect(page.total).toBe(1);
  });

  it("an unknown status, a missing source, or one on a proposal that wasn't approved reads as nothing", async () => {
    const base = await raw();
    const at = (implementation: unknown, result = "approved") => mapBudgetProposal({ ...base, result, implementation }).implementation;
    const good = { status: "disputed", date: "2026-11-27", note: null, sourceName: "Jornal", sourceUrl: "https://exemplo.pt/x" };
    expect(at(good)).toEqual(good);
    expect(at(good, "partially_approved")).toEqual(good);
    expect(at(good, "rejected")).toBeNull();
    expect(at({ ...good, status: "maybe" })).toBeNull();
    expect(at({ ...good, sourceName: "" })).toBeNull();
    expect(at({ ...good, sourceUrl: "javascript:alert(1)" })).toEqual({ ...good, sourceUrl: null });
    expect(at(undefined)).toBeNull();
    expect(at("x")).toBeNull();
  });

  it("in words, as announced, never as a fact we checked", () => {
    expect(implementationLabel("not_applied")).toBe("O Governo diz que não vai aplicar");
    expect(implementationLabel("applied")).toBe("O Governo diz que vai aplicar");
    expect(implementationLabel("disputed")).toBe("Aplicação contestada");
  });

  it("«As N propostas que o Governo diz que não vai aplicar»: N from the filter's total, 0 when an older API ignores the filter", async () => {
    expect(notAppliedCount(await getBudgetProposals(2027, { implementation: "not_applied", limit: 1 }))).toBe(1);
    // An older API sends everything back: the first item isn't one, so nothing is claimed.
    const ignored = { items: [mapBudgetProposal(await raw(28301))], nextCursor: null, total: 7 };
    expect(notAppliedCount(ignored)).toBe(0);
    expect(notAppliedCount(null)).toBe(0);
  });
});

describe("the filter in the address", () => {
  const none = { party: null, result: null, topic: null, q: null, day: null, order: null, planned: null, applied: null };
  it("?aplicacao=nao-aplicadas asks the API for implementation=not_applied, kept with the other filters", () => {
    const known = { parties: ["ps"], topics: [] };
    expect(budgetFilters({ aplicacao: "nao-aplicadas" }, known).applied).toBe("nao-aplicadas");
    expect(budgetFilters({ aplicacao: "talvez" }, known).applied).toBeNull();
    expect(queryOf({ ...none, applied: "nao-aplicadas" }).implementation).toBe("not_applied");
    expect(queryOf(none).implementation).toBeUndefined();
    expect(budgetPath(2027, true, { ...none, applied: "nao-aplicadas", party: "ps" })).toBe(
      "/orcamento?partido=ps&aplicacao=nao-aplicadas",
    );
  });
});

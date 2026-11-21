import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBudgetProposal, getBudgetProposals, getBudgets, getBudgetSummary } from "@/lib/api/budget";
import { tagsFor } from "@/lib/api/cacheTags";
import { handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

describe("the State Budget API (docs/budget-api.md)", () => {
  it("is cached under its own tag, refreshed when the parliament's file changes", () => {
    expect(tagsFor("/budget/2027/proposals?result=pending")).toEqual(["budget"]);
  });

  it("lists the Budgets, newest first, each with its own bill and its headline votes", async () => {
    const budgets = await getBudgets();
    expect(budgets?.items.map((item) => item.year)).toEqual([2027, 2026, 2005]);
    const current = budgets!.items[0]!;
    expect(current.bills[0]).toMatchObject({ initiativeId: 377352, status: "in_progress" });
    expect(current.bills[0]!.votes[0]).toMatchObject({ phase: "Votação na generalidade", result: "Aprovado" });
    expect(current.bills[0]!.votes[0]!.favor.map((entry) => entry.partySlug)).toEqual(["psd", "cds-pp"]);
    // Before 2006: the bill only, no proposals.
    expect(budgets!.items[2]).toMatchObject({ proposals: 0, syncedAt: null });
  });

  it("maps a proposal: authors, votes per party, a deputy apart, the official PDF", async () => {
    const proposal = await getBudgetProposal(2027, 28301);
    expect(proposal).toMatchObject({
      number: "1260C",
      result: "approved",
      topics: ["IRS"],
      documentUrl: "https://example.com/oe/28301.pdf",
    });
    expect(proposal!.authors.parties.map((party) => party.acronym)).toEqual(["PSD"]);
    const lines = proposal!.votes[0]!.parties;
    expect(lines[0]).toMatchObject({ party: { slug: "psd" }, deputy: null, vote: "favor" });
    expect(lines.find((line) => line.deputy)).toMatchObject({ deputy: "Rui Valadares", vote: "against" });
    expect(await getBudgetProposal(2027, 1)).toBeNull();
  });

  it("«O que muda»: the plain summary when written, marked when a model wrote it; null until then", async () => {
    expect((await getBudgetProposal(2027, 28301))?.plain).toEqual({
      summary: "Muda os escalões do IRS Jovem para quem tem até 35 anos.",
      automatic: true,
      updatedAt: expect.any(String),
    });
    expect((await getBudgetProposal(2027, 28302))?.plain).toBeNull();
  });

  it("«Nas notícias» and «O que disseram»: only on the single proposal, newest first; empty until the backend fills them", async () => {
    const proposal = await getBudgetProposal(2027, 28301);
    expect(proposal!.news.map((item) => item.id)).toEqual([100, 98]);
    expect(proposal!.news[0]).toMatchObject({ source: expect.any(String), url: "https://example.com/noticia/100" });
    // Outlets' titles come HTML-encoded, as on the feed: decoded, shown as text.
    expect(proposal!.news[0]!.title).toContain("o orçamento & a saúde");
    expect(proposal!.statements[0]!.articleTitle).toContain("& a saúde");
    expect(proposal!.statements[0]).toMatchObject({ party: { slug: "psd", acronym: "PSD" }, deputy: "Rui Valadares", articleId: 100 });
    expect(await getBudgetProposal(2027, 28302)).toMatchObject({ news: [], statements: [] });
    // The list sends only «O que muda».
    const page = await getBudgetProposals(2027, { q: "irs" });
    expect(page.items[0]).toMatchObject({ news: [], statements: [] });
  });

  it("tolerates broken news or statements: a bad item is left out, a bad list reads as none", async () => {
    const { mapBudgetProposal } = await import("@/lib/api/budget");
    const raw = await fetchRaw();
    const good = { id: 7, title: "Uma notícia", source: "Jornal", url: "javascript:alert(1)", publishedAt: "2026-11-20T10:00:00Z" };
    const mapped = mapBudgetProposal({
      ...raw,
      news: [good, { title: "sem id" }],
      statements: [
        { party: null, deputy: null, text: "Disse.", articleId: 7, articleTitle: "T", source: "Jornal", publishedAt: null },
        { text: 3 },
      ],
    });
    expect(mapped.news).toEqual([{ ...good, url: null }]);
    expect(mapped.statements).toHaveLength(1);
    expect(mapBudgetProposal({ ...raw, news: "x", statements: { a: 1 } })).toMatchObject({ news: [], statements: [] });
  });

  it("filters: still to vote is pending and sent to the plenary, together", async () => {
    const page = await getBudgetProposals(2027, { result: ["pending", "sent_to_plenary"] });
    expect(page.items.map((item) => item.result).sort()).toEqual(["pending", "pending", "sent_to_plenary"]);
    expect(page.total).toBe(3);
    const irs = await getBudgetProposals(2027, { q: "irs", party: "psd" });
    expect(irs.items.map((item) => item.id)).toEqual([28301]);
  });

  it("the summary: the parties' votes on others, the topics and the schedule of sessions to come", async () => {
    const summary = await getBudgetSummary(2027);
    expect(summary?.parties[0]).toMatchObject({ party: { slug: "psd" } });
    expect(summary?.parties[0]!.votesOnOthers.favor).toBeGreaterThan(0);
    expect(summary?.schedule.length).toBeGreaterThan(0);
    expect(summary?.schedule[0]).toMatchObject({ kind: "committee", allDay: false, stage: "committee", started: true });
    expect(summary?.schedule.find((item) => item.stage === "final_vote")).toMatchObject({ started: false, endsAt: null });
    expect(await getBudgetSummary(1999)).toBeNull();
  });

  it("tolerates what an older or newer API sends: an unknown result or vote reads as unknown, not as a crash", async () => {
    const { mapBudgetProposal } = await import("@/lib/api/budget");
    const raw = {
      ...(await fetchRaw()),
      result: "something_new",
      votes: [{ votedOn: "2026-11-19", parties: [{ party: null, group: "Não Inscrito", deputy: "Ana Lopes", vote: "maybe" }] }],
    };
    const mapped = mapBudgetProposal(raw);
    expect(mapped.result).toBe("unclear");
    expect(mapped.votes[0]!.parties[0]).toMatchObject({ party: null, vote: null });
    expect(mapped.votes[0]!.ambiguous).toBe(false);
  });
});

async function fetchRaw() {
  const response = await fetch("http://localhost/api/v2/budget/2027/proposals/28302");
  return response.json();
}

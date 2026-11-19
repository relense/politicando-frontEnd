import { describe, expect, it } from "vitest";
import type { BudgetBill, BudgetSession, BudgetVote } from "@/lib/api/budget";
import { budgetBox, budgetStage, byChoice, choiceShares, headlineVotes, partyLines, RESULT_LABELS } from "@/lib/budget";
import type { Vote } from "@/lib/types";

const party = (slug: string, acronym = slug.toUpperCase()) => ({ slug, acronym, name: acronym });
const committee = (lines: BudgetVote["parties"]): BudgetVote => ({
  votedOn: "2026-11-19",
  phase: "committee",
  result: "approved",
  unanimous: false,
  label: null,
  partLabel: null,
  parts: [],
  subject: null,
  parties: lines,
  ambiguous: false,
  ambiguity: null,
});
const headline = (date: string, phase: string, result = "Aprovado"): Vote => ({
  id: date,
  date,
  phase,
  result,
  unanimous: false,
  favor: [{ partySlug: "psd", count: null }],
  against: [{ partySlug: "chega", count: null }],
  abstention: [{ partySlug: "ps", count: null }],
  absent: [],
  named: [],
});
const bill = (status: string, votes: Vote[]): BudgetBill => ({
  initiativeId: 1,
  legislature: "XVII",
  number: "110",
  title: "OE",
  status,
  votes,
});

describe("the State Budget's rules (lib/budget)", () => {
  it("words results in the parliament's neutral terms", () => {
    expect(RESULT_LABELS.approved).toBe("Aprovada");
    expect(RESULT_LABELS.sent_to_plenary).toBe("Avocada pelo Plenário");
    expect(RESULT_LABELS.superseded).toBe("Prejudicada");
  });

  it("each party's line, with a deputy who voted apart under it («PSD: a favor (Rui Valadares: contra)»)", () => {
    const vote = committee([
      { party: party("psd"), group: "PSD", deputy: null, vote: "favor" },
      { party: party("ps"), group: "PS", deputy: null, vote: "abstention" },
      { party: party("psd"), group: "Rui Valadares(PSD)", deputy: "Rui Valadares", vote: "against" },
      { party: null, group: "Não Inscrito", deputy: "Ana Lopes", vote: "favor" },
    ]);
    expect(partyLines(vote)).toEqual([
      { key: "psd", label: "PSD", slug: "psd", vote: "favor", apart: [{ deputy: "Rui Valadares", vote: "against" }] },
      { key: "ps", label: "PS", slug: "ps", vote: "abstention", apart: [] },
      { key: "Ana Lopes", label: "Ana Lopes", slug: null, vote: "favor", apart: [] },
    ]);
    expect(byChoice(vote)).toEqual({ favor: ["PSD", "Ana Lopes"], abstention: ["PS"], against: [], absent: [] });
  });

  it("shares of a party's votes on others' proposals, absences left out", () => {
    expect(choiceShares({ favor: 1, against: 2, abstention: 1, absent: 6 })).toEqual({ favor: 25, abstention: 25, against: 50 });
    expect(choiceShares({ favor: 0, against: 0, abstention: 0, absent: 0 })).toBeNull();
  });

  it("the Budget's headline votes and its stage", () => {
    const general = headline("2026-10-31", "Votação na generalidade");
    const final = headline("2026-11-27", "Votação final global");
    expect(headlineVotes([bill("in_progress", [general])])).toEqual({ general, final: null });
    expect(budgetStage([bill("in_progress", [general])])).toEqual({ label: "Em especialidade", tone: "pending" });
    expect(budgetStage([bill("approved", [general, final])])).toEqual({ label: "Aprovado", tone: "approved" });
    const fell = headline("2021-10-27", "Votação na generalidade", "Rejeitado");
    expect(budgetStage([bill("rejected", [fell])])).toEqual({ label: "Chumbado na generalidade", tone: "rejected" });
    // 2022: the one rejected in 2021 and the one approved; the latest decides.
    expect(budgetStage([bill("rejected", [fell]), bill("approved", [general, final])])?.label).toBe("Aprovado");
  });

  describe("the side box: during a session, a day without votes, after the final vote", () => {
    const now = Date.parse("2026-11-19T16:42:00Z");
    const session = (startsAt: string, allDay = false): BudgetSession => ({
      id: startsAt,
      title: "Comissão de Orçamento",
      kind: "committee",
      startsAt,
      allDay,
    });
    const open = [bill("in_progress", [headline("2026-10-31", "Votação na generalidade")])];

    it("a session that started today: «Sessão de votação»", () => {
      const box = budgetBox({ bills: open, schedule: [session("2026-11-19T15:00:00Z"), session("2026-11-20T15:00:00Z")], pending: 9 }, now);
      expect(box).toMatchObject({ state: "session", session: { startsAt: "2026-11-19T15:00:00Z" } });
    });
    it("otherwise the next session to come", () => {
      const box = budgetBox({ bills: open, schedule: [session("2026-11-18T15:00:00Z"), session("2026-11-20T15:00:00Z")], pending: 9 }, now);
      expect(box).toMatchObject({ state: "between", next: { startsAt: "2026-11-20T15:00:00Z" } });
      expect(budgetBox({ bills: open, schedule: [], pending: 9 }, now)).toMatchObject({ state: "between", next: null });
    });
    it("after the final vote: on the news for 7 days, on the Budget's page for good", () => {
      const done = [bill("approved", [headline("2026-10-31", "Votação na generalidade"), headline("2026-11-27", "Votação final global")])];
      const after = (days: number) => Date.parse("2026-11-27T18:00:00Z") + days * 86_400_000;
      expect(budgetBox({ bills: done, schedule: [], pending: 0 }, after(6))).toMatchObject({
        state: "final",
        final: { date: "2026-11-27" },
      });
      expect(budgetBox({ bills: done, schedule: [], pending: 0 }, after(8))).toBeNull();
      expect(budgetBox({ bills: done, schedule: [], pending: 0 }, after(8), { keep: true })).toMatchObject({ state: "final" });
    });
    it("nothing for a Budget with nothing left and no final vote recorded", () => {
      expect(budgetBox({ bills: open, schedule: [], pending: 0 }, now)).toBeNull();
    });
  });
});

import { describe, expect, it } from "vitest";
import type { BudgetBill, BudgetSession, BudgetVote } from "@/lib/api/budget";
import {
  authorsShort,
  budgetBox,
  finalVoteSession,
  sessionTime,
  budgetStage,
  byChoice,
  choiceShares,
  headlineVotes,
  partyFull,
  partyLines,
  partyShort,
  proposalHeading,
  RESULT_LABELS,
  votedLine,
} from "@/lib/budget";
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
    const session = (startsAt: string, allDay = false, more: Partial<BudgetSession> = {}): BudgetSession => ({
      id: startsAt,
      title: "Comissão de Orçamento",
      kind: "committee",
      stage: "committee",
      startsAt,
      endsAt: null,
      allDay,
      started: null,
      ...more,
    });
    const open = [bill("in_progress", [headline("2026-10-31", "Votação na generalidade")])];

    it("a session that started today: «Sessão de votação»", () => {
      const box = budgetBox({ bills: open, schedule: [session("2026-11-19T15:00:00Z"), session("2026-11-20T15:00:00Z")], pending: 9 }, now);
      expect(box).toMatchObject({ state: "session", session: { startsAt: "2026-11-19T15:00:00Z" } });
    });
    it("the API's «started» decides: a session it says began counts, one it says hasn't doesn't, whatever the clock", () => {
      const late = session("2026-11-19T17:00:00Z", false, { started: true });
      expect(budgetBox({ bills: open, schedule: [late], pending: 9 }, now)).toMatchObject({ state: "session", session: { id: late.id } });
      const notYet = session("2026-11-19T15:00:00Z", false, { started: false });
      expect(budgetBox({ bills: open, schedule: [notYet], pending: 9 }, now)).toMatchObject({ state: "between" });
    });
    it("a session that began on another day isn't today's, even if a cached page still says started", () => {
      const yesterday = session("2026-11-18T10:00:00Z", false, { started: true });
      expect(budgetBox({ bills: open, schedule: [yesterday], pending: 9 }, now)).toMatchObject({ state: "between" });
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

describe("names and headings readers understand (owner's review, 20 Nov)", () => {
  const livre = { slug: "livre", acronym: "L", name: "LIVRE" };
  const psd = { slug: "psd", acronym: "PSD", name: "Partido Social Democrata" };
  it("a one-letter acronym says the name: «LIVRE», not «L»; the page spells it out: «Livre»", () => {
    expect(partyShort(livre)).toBe("LIVRE");
    expect(partyShort(psd)).toBe("PSD");
    expect(partyFull(livre)).toBe("Livre");
    expect(authorsShort({ parties: [livre, psd], deputies: [], label: "L, PSD" })).toBe("LIVRE, PSD");
    expect(authorsShort({ parties: [], deputies: ["Ana Lopes"], label: "Ana Lopes" })).toBe("Ana Lopes");
  });
  const base = {
    title: "Alínea f), N.º 1, N.º 5, Artigo 9.º do Código do IRS",
    plain: null,
    votes: [] as { votedOn: string | null; phase: "committee" | "plenary" | null }[],
  };
  it("«O que muda» leads when written, the official title under it; otherwise the official title alone", () => {
    expect(proposalHeading(base)).toEqual({ main: base.title, official: null });
    const plain = { summary: "Muda os escalões do IRS Jovem.", automatic: true, updatedAt: null };
    expect(proposalHeading({ ...base, plain })).toEqual({ main: "Muda os escalões do IRS Jovem.", official: base.title });
  });
  it("when and where it was voted: «Votada a 19-11-2026, em Comissão»", () => {
    expect(votedLine({ ...base, votes: [{ votedOn: "2026-11-19", phase: "committee" }] })).toBe("Votada a 19-11-2026, em Comissão");
    expect(
      votedLine({
        ...base,
        votes: [
          { votedOn: "2026-11-19", phase: "committee" },
          { votedOn: "2026-11-24", phase: "plenary" },
        ],
      }),
    ).toBe("Votada a 24-11-2026, no Plenário");
    expect(votedLine(base)).toBeNull();
  });
});

describe("the final overall vote's session, shown ahead of time", () => {
  const entry = (stage: BudgetSession["stage"], startsAt: string): BudgetSession => ({
    id: startsAt,
    title: "Sessão",
    kind: "parliament",
    stage,
    startsAt,
    endsAt: null,
    allDay: false,
    started: false,
  });
  it("the session marked final_vote, or none when the agenda doesn't show it yet", () => {
    const final = entry("final_vote", "2026-11-24T10:00:00Z");
    expect(finalVoteSession([entry("committee", "2026-11-20T15:00:00Z"), final])).toBe(final);
    expect(finalVoteSession([entry("plenary", "2026-11-21T10:00:00Z")])).toBeNull();
  });
  it("«10h00»: hours as written in Portugal, in Lisbon's time", () => {
    expect(sessionTime("2026-11-24T10:00:00Z")).toBe("10h00");
    expect(sessionTime("2026-07-24T14:30:00Z")).toBe("15h30");
  });
});

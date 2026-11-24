import { describe, expect, it } from "vitest";
import type { BudgetBill, BudgetBillVote, BudgetPlanned, BudgetSession, BudgetVote, BudgetVotingDay } from "@/lib/api/budget";
import {
  awaitingResults,
  nextPlanned,
  plannedDays,
  plannedLine,
  statementGroups,
  authorsShort,
  authorsPhrase,
  budgetBox,
  budgetTally,
  tidyStatus,
  finalVoteSession,
  sessionTime,
  budgetStage,
  byChoice,
  choiceShares,
  headlineVotes,
  partyFull,
  partyLines,
  partyShort,
  provisionalNote,
  RESULT_LABELS,
  votedLine,
} from "@/lib/budget";

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
const headline = (date: string, phase: string, result = "Aprovado"): BudgetBillVote => ({
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
  provisional: false,
  source: null,
});
const bill = (status: string, votes: BudgetBillVote[]): BudgetBill => ({
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
    // Rounded so they add up to 100, never below 0.
    expect(choiceShares({ favor: 1, against: 0, abstention: 7, absent: 0 })).toEqual({ favor: 13, abstention: 87, against: 0 });
    expect(choiceShares({ favor: 1, against: 1, abstention: 1, absent: 0 })).toEqual({ favor: 34, abstention: 33, against: 33 });
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
    it("two sessions began today (the plenary at 10h, the committee at 15h): the latest, the one on now", () => {
      const morning = session("2026-11-19T10:00:00Z", false, { started: true, stage: "plenary" });
      const afternoon = session("2026-11-19T15:00:00Z", false, { started: true });
      expect(budgetBox({ bills: open, schedule: [morning, afternoon], pending: 9 }, now)).toMatchObject({ session: { id: afternoon.id } });
      expect(budgetBox({ bills: open, schedule: [afternoon, morning], pending: 9 }, now)).toMatchObject({ session: { id: afternoon.id } });
    });
    it("results the parliament hasn't published: the session began and its planned proposals are all still to vote", () => {
      const day = (venue: "committee" | "plenary", proposals: number, pending: number): BudgetVotingDay => ({
        date: "2026-11-19",
        venue,
        proposals,
        pending,
      });
      const days = [day("plenary", 6, 0), day("committee", 236, 236)];
      expect(awaitingResults(session("2026-11-19T15:00:00Z"), days, "2026-11-19")).toBe("committee");
      // The plenary's are in; the final vote's session is a plenary.
      expect(awaitingResults(session("2026-11-19T10:00:00Z", false, { stage: "plenary" }), days, "2026-11-19")).toBeNull();
      expect(awaitingResults(session("2026-11-19T10:00:00Z", false, { stage: "final_vote" }), [day("plenary", 2, 2)], "2026-11-19")).toBe(
        "plenary",
      );
      // Some already in: they're coming, nothing to explain. No script for it, or an older API with no stage: nothing said.
      expect(awaitingResults(session("2026-11-19T15:00:00Z"), [day("committee", 236, 100)], "2026-11-19")).toBeNull();
      expect(awaitingResults(session("2026-11-19T15:00:00Z"), [], "2026-11-19")).toBeNull();
      expect(awaitingResults(session("2026-11-19T15:00:00Z", false, { stage: null }), days, "2026-11-19")).toBeNull();
      expect(awaitingResults(null, days, "2026-11-19")).toBeNull();
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

describe("the numbers at the top add up", () => {
  // OE2027 on 20 Nov: 2 919 proposals.
  const results = {
    pending: 1584,
    sent_to_plenary: 40,
    approved: 151,
    partially_approved: 19,
    rejected: 1052,
    withdrawn: 49,
    not_admitted: 19,
    superseded: 4,
    unclear: 1,
  };
  it("voted = approved + rejected, still to vote, and the rest named, so they make the total", () => {
    const tally = budgetTally(results);
    expect(tally).toMatchObject({ total: 2919, voted: 1222, approved: 170, rejected: 1052, pending: 1624, other: 73 });
    expect(tally.voted + tally.pending + tally.other).toBe(tally.total);
    expect(tally.otherLabel).toBe("retiradas, não admitidas, prejudicadas ou por esclarecer");
  });
  it("names only what there is, and nothing when there's none", () => {
    expect(budgetTally({ approved: 2, withdrawn: 3, not_admitted: 1 }).otherLabel).toBe("retiradas ou não admitidas");
    expect(budgetTally({ approved: 2, pending: 1 })).toMatchObject({ other: 0, otherLabel: null });
  });
  it("one is singular: «1 retirada»", () => {
    expect(budgetTally({ approved: 2, withdrawn: 1 }).otherLabel).toBe("retirada");
    expect(budgetTally({ approved: 2, unclear: 1 }).otherLabel).toBe("por esclarecer");
  });
});

describe("who proposed it, in a sentence", () => {
  const party = (slug: string, acronym: string, name = acronym) => ({ slug, acronym, name });
  it("«do PCP», «da IL», «do PSD e do CDS-PP», «de» a deputy", () => {
    expect(authorsPhrase({ parties: [party("pcp", "PCP")], deputies: [], label: "PCP" })).toBe("do PCP");
    expect(authorsPhrase({ parties: [party("il", "IL")], deputies: [], label: null })).toBe("da IL");
    expect(authorsPhrase({ parties: [party("psd", "PSD"), party("cds-pp", "CDS-PP")], deputies: [], label: null })).toBe(
      "do PSD e do CDS-PP",
    );
    expect(authorsPhrase({ parties: [], deputies: ["Ana Lopes"], label: null })).toBe("de Ana Lopes");
    expect(authorsPhrase({ parties: [party("livre", "L", "Livre")], deputies: [], label: null })).toBe("do LIVRE");
    expect(authorsPhrase({ parties: [], deputies: [], label: null })).toBeNull();
  });
});

describe("the official status, without the source's «(a)»", () => {
  it("a proposal is feminine: «Rejeitada em Comissão»", () => {
    expect(tidyStatus("Rejeitado(a) em Comissão")).toBe("Rejeitada em Comissão");
    expect(tidyStatus("Aprovado(a) em Plenário")).toBe("Aprovada em Plenário");
    expect(tidyStatus("Retirada")).toBe("Retirada");
    expect(tidyStatus(null)).toBeNull();
  });
});

describe("«O que disseram», grouped by party", () => {
  const said = (slug: string | null, publishedAt: string | null, text = "Disse.") => ({
    party: slug ? { slug, acronym: slug.toUpperCase(), name: slug } : null,
    speaker: null,
    text,
    articleId: 1,
    articleTitle: "T",
    source: "Jornal",
    publishedAt,
  });

  it("leaves out statements without a party; the party with the newest statement first, newest first inside", () => {
    const groups = statementGroups([
      said("ps", "2026-11-18T10:00:00Z", "ps antiga"),
      said(null, "2026-11-21T10:00:00Z"),
      said("psd", "2026-11-19T10:00:00Z"),
      said("ps", "2026-11-20T10:00:00Z", "ps nova"),
      said("chega", null),
    ]);
    expect(groups.map((group) => group.party.slug)).toEqual(["ps", "psd", "chega"]);
    expect(groups[0]!.statements.map((item) => item.text)).toEqual(["ps nova", "ps antiga"]);
    expect(statementGroups([said(null, null)])).toEqual([]);
    // By the moment, not the text: 10:30 in Lisbon summer time (+01:00) is before 10:00 UTC.
    const mixed = statementGroups([said("ps", "2026-07-01T10:30:00+01:00", "antes"), said("ps", "2026-07-01T10:00:00Z", "depois")]);
    expect(mixed[0]!.statements.map((item) => item.text)).toEqual(["depois", "antes"]);
  });
});

// The parliament's voting scripts: planned, not certain (docs/budget-api.md, "What's voted on which day").
describe("planned voting days, from the scripts", () => {
  const today = "2026-11-23";
  const on = (date: string, venue: "committee" | "plenary" = "committee"): BudgetPlanned => ({
    date,
    venue,
    position: 1,
    scriptUrl: "https://example.com/guiao.pdf",
  });

  it("shows the next planned day only while it's still to be voted; once voted, the result instead", () => {
    expect(nextPlanned({ result: "pending", scheduled: [on(today)] }, today)).toEqual(on(today));
    expect(nextPlanned({ result: "sent_to_plenary", scheduled: [on(today)] }, today)).toEqual(on(today));
    expect(nextPlanned({ result: "approved", scheduled: [on(today)] }, today)).toBeNull();
    expect(nextPlanned({ result: "pending", scheduled: [] }, today)).toBeNull();
  });

  it("on two days (committee, then the plenary): the next one to come; a day gone by without the vote (postponed) is dropped", () => {
    const both = [on("2026-11-20"), on("2026-11-25", "plenary")];
    expect(nextPlanned({ result: "pending", scheduled: both }, today)).toEqual(on("2026-11-25", "plenary"));
    expect(nextPlanned({ result: "pending", scheduled: [on("2026-11-20")] }, today)).toBeNull();
  });

  it("reads as a sentence: today, or the day, and where", () => {
    expect(plannedLine(on(today), today)).toBe("Prevista para votação hoje, em comissão");
    expect(plannedLine(on("2026-11-24", "plenary"), today)).toBe("Prevista para votação a 24-11-2026, em plenário");
  });

  it("the days ahead: one per day from today, committee and plenary together", () => {
    const days: BudgetVotingDay[] = [
      { date: "2026-11-19", venue: "plenary", proposals: 12, pending: 0 },
      { date: today, venue: "committee", proposals: 236, pending: 230 },
      { date: today, venue: "plenary", proposals: 6, pending: 6 },
      { date: "2026-11-24", venue: "plenary", proposals: 2, pending: 2 },
    ];
    expect(plannedDays(days, today)).toEqual([
      { date: today, proposals: 242, pending: 236, venues: ["committee", "plenary"] },
      { date: "2026-11-24", proposals: 2, pending: 2, venues: ["plenary"] },
    ]);
    expect(plannedDays([], today)).toEqual([]);
  });
});

describe("a Budget vote added from the news, before the parliament publishes it", () => {
  it("says so, with its source (no article guessed before the outlet's name), linking the source; an official vote says nothing", () => {
    expect(provisionalNote({ provisional: true, source: { name: "RTP", url: "https://rtp.example/oe" } })).toEqual({
      text: "Provisório (fonte: RTP), ainda não publicado pelo Parlamento",
      url: "https://rtp.example/oe",
    });
    expect(provisionalNote({ provisional: true, source: { name: "Jornal de Exemplo", url: null } })).toEqual({
      text: "Provisório (fonte: Jornal de Exemplo), ainda não publicado pelo Parlamento",
      url: null,
    });
    expect(provisionalNote({ provisional: true, source: null })).toEqual({
      text: "Provisório, ainda não publicado pelo Parlamento",
      url: null,
    });
    expect(provisionalNote({ provisional: false, source: null })).toBeNull();
  });
});

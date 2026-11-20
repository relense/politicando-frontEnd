import { describe, expect, it } from "vitest";
import { boardPath, discussingNow, ideaTimeline, IDEA_FILTERS, IDEA_SORTS, boardQuery } from "@/lib/ideas";

const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T10:00:00.000Z`;

describe("an idea's timeline: Proposta → Em análise → A fazer → Feita", () => {
  it("each step dated when the idea first got there; «Feita» with the expected date until it's done", () => {
    const steps = ideaTimeline({
      status: "in_progress",
      expectedOn: "2026-11-27",
      statusHistory: [
        { status: null, at: at(14) },
        { status: "reviewing", at: at(15) },
        { status: "planned", at: at(19) },
        { status: "in_progress", at: at(20) },
      ],
    });
    expect(steps).toEqual([
      { label: "Proposta", date: at(14), state: "done" },
      { label: "Em análise", date: at(15), state: "done" },
      // Planned or being done: both «A fazer», from the first of them.
      { label: "A fazer", date: at(19), state: "current" },
      { label: "Feita", date: "2026-11-27", state: "expected" },
    ]);
  });
  it("a step skipped still counts as passed; one not reached has no date", () => {
    expect(
      ideaTimeline({
        status: "done",
        expectedOn: null,
        statusHistory: [
          { status: null, at: at(1) },
          { status: "done", at: at(9) },
        ],
      }),
    ).toEqual([
      { label: "Proposta", date: at(1), state: "done" },
      { label: "Em análise", date: null, state: "done" },
      { label: "A fazer", date: null, state: "done" },
      { label: "Feita", date: at(9), state: "current" },
    ]);
    expect(ideaTimeline({ status: null, expectedOn: null, statusHistory: [{ status: null, at: at(1) }] })).toEqual([
      { label: "Proposta", date: at(1), state: "current" },
      { label: "Em análise", date: null, state: "todo" },
      { label: "A fazer", date: null, state: "todo" },
      { label: "Feita", date: null, state: "todo" },
    ]);
  });
  it("declined ends at «Não vamos fazer»; a duplicate has no timeline (it points to the original)", () => {
    const steps = ideaTimeline({
      status: "declined",
      expectedOn: null,
      statusHistory: [
        { status: null, at: at(1) },
        { status: "reviewing", at: at(2) },
        { status: "declined", at: at(5) },
      ],
    });
    expect(steps.map((step) => [step.label, step.state])).toEqual([
      ["Proposta", "done"],
      ["Em análise", "done"],
      ["Não vamos fazer", "current"],
    ]);
    expect(steps.at(-1)?.date).toBe(at(5));
    expect(ideaTimeline({ status: "duplicate", expectedOn: null, statusHistory: [] })).toEqual([]);
  });
});

describe("«a discutir agora»", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  it("a reply in the last hour", () => {
    expect(discussingNow({ replyCount: 3, bumpedAt: "2026-11-20T11:15:00Z" }, now)).toBe(true);
    expect(discussingNow({ replyCount: 3, bumpedAt: "2026-11-20T10:59:00Z" }, now)).toBe(false);
    // Just opened, nobody answered yet: not a discussion.
    expect(discussingNow({ replyCount: 0, bumpedAt: "2026-11-20T11:59:00Z" }, now)).toBe(false);
  });
});

describe("the board's address: tabs and status filters in Portuguese", () => {
  it("most voted and every status by default; the rest in the query", () => {
    expect(IDEA_SORTS.map((sort) => sort.label)).toEqual(["Mais votadas", "Novas", "A discutir"]);
    expect(IDEA_FILTERS.map((filter) => filter.label)).toEqual(["Em análise", "Planeadas", "A fazer", "Feitas", "Não vamos fazer"]);
    expect(boardPath({ sort: "top", status: null })).toBe("/feedback");
    expect(boardPath({ sort: "active", status: "in_progress", page: 2 })).toBe("/feedback?ordem=a-discutir&estado=a-fazer&pagina=2");
    expect(boardQuery({ ordem: "novas", estado: "feitas", pagina: "3" })).toEqual({ sort: "new", status: "done", page: 3 });
    expect(boardQuery({ ordem: "x", estado: "duplicadas", pagina: "0" })).toEqual({ sort: "top", status: null, page: 1 });
  });
});

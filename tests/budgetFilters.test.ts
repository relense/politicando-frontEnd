import { describe, expect, it } from "vitest";
import { budgetFilters, budgetPath, queryOf } from "@/lib/budgetFilters";

const known = { parties: ["psd", "ps"], topics: ["IRS", "Saúde"] };

describe("the State Budget's filters, from and to the address", () => {
  it("reads only what it knows; a bad value is dropped, not passed to the API", () => {
    expect(budgetFilters({ partido: "ps", resultado: "por-votar", tema: "IRS", q: "  irs jovem ", dia: "2026-11-19" }, known)).toEqual({
      party: "ps",
      result: "por-votar",
      topic: "IRS",
      q: "irs jovem",
      day: "2026-11-19",
      order: null,
    });
    expect(budgetFilters({ partido: "xyz", resultado: "ganhas", tema: "Nada", dia: "ontem", q: ["a", "b"] }, known)).toEqual({
      party: null,
      result: null,
      topic: null,
      q: null,
      day: null,
      order: null,
    });
  });
  it("asks the API for what each tab means: «Por votar» is pending and sent to the plenary", () => {
    const none = { party: null, result: null, topic: null, q: null, day: null, order: null };
    expect(queryOf({ ...none, result: "por-votar" }).result).toEqual(["pending", "sent_to_plenary"]);
    expect(queryOf({ ...none, result: "aprovadas" }).result).toEqual(["approved", "partially_approved"]);
    expect(queryOf({ ...none, day: "2026-11-19", party: "ps" })).toMatchObject({
      votedFrom: "2026-11-19",
      votedTo: "2026-11-19",
      party: "ps",
    });
    expect(queryOf(none).result).toBeUndefined();
  });
  it("writes the address: the current Budget at /orcamento, others under their year", () => {
    const none = { party: null, result: null, topic: null, q: null, day: null, order: null };
    expect(budgetPath(2027, true, none)).toBe("/orcamento");
    expect(budgetPath(2025, false, { ...none, party: "ps", result: "rejeitadas" })).toBe("/orcamento/2025?partido=ps&resultado=rejeitadas");
  });

  // A journalist going through them one by one from the start: the parliament's numbering (1C, 2C, 3C…), across every day.
  it("orders by the proposal's number with ?ordem=numero, kept with the other filters; the latest vote first otherwise", () => {
    const none = { party: null, result: null, topic: null, q: null, day: null, order: null };
    expect(budgetFilters({ ordem: "numero" }, known).order).toBe("numero");
    expect(budgetFilters({ ordem: "alfabetica" }, known).order).toBeNull();
    expect(queryOf({ ...none, order: "numero" }).sort).toBe("number");
    expect(queryOf(none).sort).toBeUndefined();
    expect(budgetPath(2027, true, { ...none, order: "numero", party: "ps" })).toBe("/orcamento?partido=ps&ordem=numero");
  });
});

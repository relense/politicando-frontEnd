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
    });
    expect(budgetFilters({ partido: "xyz", resultado: "ganhas", tema: "Nada", dia: "ontem", q: ["a", "b"] }, known)).toEqual({
      party: null,
      result: null,
      topic: null,
      q: null,
      day: null,
    });
  });
  it("asks the API for what each tab means: «Por votar» is pending and sent to the plenary", () => {
    const none = { party: null, result: null, topic: null, q: null, day: null };
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
    const none = { party: null, result: null, topic: null, q: null, day: null };
    expect(budgetPath(2027, true, none)).toBe("/orcamento");
    expect(budgetPath(2025, false, { ...none, party: "ps", result: "rejeitadas" })).toBe("/orcamento/2025?partido=ps&resultado=rejeitadas");
  });
});

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  byCompetition,
  competitionOf,
  directAwardTotals,
  formatEurosShort,
  getContract,
  getContractParty,
  getContracts,
  getContractStats,
  mapContractDetail,
  mapContractSummary,
  procedureFilter,
  share,
} from "@/lib/api/contracts";
import { API, handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const raw = {
  id: "1",
  object: "Refeições escolares",
  procedure: { kind: "direct_award", label: "Ajuste direto", published: "Ajuste Direto Regime Geral" },
  contractTypes: ["Aquisição de serviços"],
  price: 1000,
  publishedAt: "2026-10-26",
  signedAt: "2026-09-11",
  entities: [{ nif: "600000001", name: "Município de Vale Formoso" }],
  suppliers: [{ nif: "", name: "Joana Exemplo" }],
  places: ["Portugal, Aveiro, Águeda"],
  baseUrl: "javascript:alert(1)",
};

describe("contract mappers", () => {
  it("drops missing NIFs and unsafe links", () => {
    const contract = mapContractSummary(raw);
    expect(contract.suppliers).toEqual([{ nif: null, name: "Joana Exemplo" }]);
    expect(contract.entities[0]!.nif).toBe("600000001");
    expect(contract.baseUrl).toBeNull();
  });

  it("keeps a description only when it adds to the object, and only local places", () => {
    const detail = mapContractDetail({
      ...raw,
      description: "Refeições escolares ",
      municipalities: [
        { key: "LOCAL-010100", name: "Águeda" },
        { key: "GLOBAL-000000", name: "Portugal" },
      ],
      status: "  ",
      documentsUrl: "https://example.org/docs",
    });
    expect(detail.description).toBeNull();
    expect(detail.municipalities).toEqual([{ key: "LOCAL-010100", name: "Águeda" }]);
    expect(detail.status).toBeNull();
    expect(detail.centralized).toBe(false);
    expect(detail.documentsUrl).toBe("https://example.org/docs");
  });
});

describe("contract helpers", () => {
  const procedures = [
    { kind: "direct_award", label: "", plain: null, count: 60, total: 300 },
    { kind: "direct_award_simplified", label: "", plain: null, count: 20, total: 0 },
    { kind: "public_tender", label: "", plain: null, count: 15, total: 600 },
    { kind: "framework_agreement", label: "", plain: null, count: 5, total: 100 },
  ];

  it("adds up the ajustes diretos and their shares", () => {
    expect(directAwardTotals(procedures)).toEqual({ count: 80, total: 300, allCount: 100, allTotal: 1000, countShare: 80, totalShare: 30 });
    expect(directAwardTotals([]).totalShare).toBe(0);
  });

  it("groups procedures by competition", () => {
    expect(competitionOf("prior_consultation")).toBe("limited");
    expect(competitionOf("limited_tender")).toBe("open");
    expect(byCompetition(procedures)).toEqual({
      open: { count: 15, total: 600 },
      limited: { count: 80, total: 300 },
      other: { count: 5, total: 100 },
    });
  });

  it("formats euros short and shares", () => {
    expect(formatEurosShort(8_656_789_899)).toBe("8,7 mil milhões €");
    expect(formatEurosShort(12_340_000)).toBe("12,3 milhões €");
    expect(formatEurosShort(230_349.4).replace(/\s/g, " ")).toBe("230 349 €");
    expect(share(1, 0)).toBe(0);
    expect(share(1, 4)).toBe(25);
  });

  it("reads the procedure filter from the address", () => {
    expect(procedureFilter(undefined)).toEqual({ value: "direct_award", procedure: "direct_award" });
    expect(procedureFilter("todos")).toEqual({ value: "todos", procedure: undefined });
    expect(procedureFilter("public_tender").procedure).toBe("public_tender");
    expect(procedureFilter("<script>").procedure).toBe("direct_award");
  });
});

describe("contracts client", () => {
  it("pages through contracts by cursor", async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await getContracts({ cursor, limit: 7 });
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(ids).size).toBe(30);
  });

  it("filters by place and reads stats, contracts and parties", async () => {
    const page = await getContracts({ place: "LOCAL-111100" });
    expect(page.items.every((item) => item.places[0]!.includes("Sintra"))).toBe(true);
    const stats = await getContractStats("year");
    expect(stats.items.map((item) => item.key)).toEqual(["2025", "2026"]);
    const contract = await getContract(page.items[0]!.id);
    expect(contract.municipalities[0]!.name).toBe("Sintra");
    const party = await getContractParty("600000001");
    expect(party.asEntity.count).toBeGreaterThan(0);
  });

  it("rejects a malformed answer", async () => {
    server.use(http.get(`${API}/contracts`, () => HttpResponse.json({ items: [{ id: 1 }] })));
    await expect(getContracts()).rejects.toThrow(/Unexpected response/);
  });
});

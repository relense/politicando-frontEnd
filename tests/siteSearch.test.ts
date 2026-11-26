import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { matchesAll, searchSite } from "@/lib/siteSearch";
import { handlers } from "@/mocks/handlers";

// One search across the site (/procurar): each section the API can already search, asked together, a few hits each.
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const group = (result: Awaited<ReturnType<typeof searchSite>>, key: string) =>
  result.state === "done" ? result.groups.find((entry) => entry.key === key) : undefined;

describe("matching a name", () => {
  it("every word, accents and case ignored, parts of words too", () => {
    expect(matchesAll("Águeda", "agueda")).toBe(true);
    expect(matchesAll("Marta Quintela", "quint mar")).toBe(true);
    expect(matchesAll("Marta Quintela", "marta silva")).toBe(false);
  });
});

describe("the site's search", () => {
  it("needs at least 3 letters", async () => {
    expect(await searchSite("ab")).toEqual({ state: "too_short" });
    expect(await searchSite("   ")).toEqual({ state: "too_short" });
  });

  it("finds a mayor under Pessoas, linking to their page", async () => {
    const people = group(await searchSite("Marta Quintela"), "pessoas");
    expect(people?.hits[0]).toEqual({
      title: "Marta Quintela",
      meta: "Presidente da Câmara Municipal de Águeda · PS",
      href: "/autarcas/marta-quintela",
    });
  });

  it("finds a place under Sítios, saying what kind it is", async () => {
    const places = group(await searchSite("agueda"), "sitios");
    expect(places?.hits[0]).toEqual({ title: "Águeda", meta: "Município · distrito de Aveiro", href: "/sitios/LOCAL-010100" });
  });

  it("finds Budget proposals, with a link to all of them in the Budget's own list", async () => {
    const budget = group(await searchSite("irs"), "orcamento");
    expect(budget?.hits[0]).toMatchObject({ title: "Artigo 9.º do Código do IRS", href: "/orcamento/2027/proposta/28301" });
    expect(budget?.more).toBe("/orcamento?q=irs#propostas");
  });

  it("groups with nothing found are left out; the groups keep the page's order", async () => {
    const result = await searchSite("agueda");
    expect(result.state).toBe("done");
    if (result.state !== "done") return;
    expect(result.groups.every((entry) => entry.hits.length > 0)).toBe(true);
    const order = ["pessoas", "sitios", "partidos", "noticias", "historias", "iniciativas", "orcamento", "contratos", "forum"];
    const keys = result.groups.map((entry) => entry.key);
    expect([...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(keys);
  });

  it("one section down doesn't stop the others; everything down says so", async () => {
    server.use(http.get("*/api/v2/budget", () => HttpResponse.json({}, { status: 500 })));
    expect(group(await searchSite("agueda"), "sitios")).toBeDefined();
    server.use(http.get("*", () => HttpResponse.json({}, { status: 500 })));
    expect(await searchSite("agueda")).toEqual({ state: "error" });
  });
});

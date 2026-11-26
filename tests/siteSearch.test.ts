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

  it("finds anyone elected locally by name (backend: GET /local-officials/search): a junta's president links to the parish", async () => {
    const { searchLocalOfficials } = await import("@/lib/api/localOfficials");
    const [first] = await searchLocalOfficials("Fermentelos", 50).catch(() => []);
    expect(first).toBeUndefined(); // a place's name isn't a person's
    const found = await searchLocalOfficials("glória", 50);
    const president = found.find((item) => item.organ === "AF" && item.president)!;
    expect(president).toBeDefined();
    const people = group(await searchSite(president.name), "pessoas");
    expect(people?.hits).toContainEqual({
      title: president.name,
      meta: expect.stringMatching(/^Presidente da Junta de Freguesia de .+ \(.+\)/),
      href: `/sitios/${president.place.key}#orgaos`,
    });
  });

  it("an older API without the local search still finds mayors from the places list", async () => {
    server.use(http.get("*/api/v2/local-officials/search", () => HttpResponse.json({ error: "not_found" }, { status: 404 })));
    const people = group(await searchSite("Marta Quintela"), "pessoas");
    expect(people?.hits[0]).toMatchObject({ title: "Marta Quintela", href: "/autarcas/marta-quintela" });
  });

  it("the local search's answer is read tolerantly: a bad item is left out, a vereador links to the câmara", async () => {
    server.use(
      http.get("*/api/v2/local-officials/search", () =>
        HttpResponse.json({
          items: [
            {
              name: "Lívia Exemplo",
              organ: "CM",
              role: null,
              place: { key: "LOCAL-130300", name: "Felgueiras", level: "municipality" },
              municipality: null,
              list: "PS",
              label: "Partido Socialista",
              parties: ["ps"],
              localOfficialId: null,
              election: "autarquicas-2025",
            },
            { name: 3 },
          ],
          total: 2,
        }),
      ),
    );
    const people = group(await searchSite("livia exemplo"), "pessoas");
    expect(people?.hits).toEqual([
      { title: "Lívia Exemplo", meta: "Câmara Municipal de Felgueiras · PS", href: "/sitios/LOCAL-130300#orgaos" },
    ]);
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

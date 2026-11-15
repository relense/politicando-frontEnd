import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { caseDetailSchema, casePageSchema, getInterests, interestsSchema, mapCaseDetail, mapCasePage, mapInterests } from "@/lib/api/cases";
import { featuredSchema, mapFeatured, mapPersonPath, personHref, personPathSchema, tryPersonPath } from "@/lib/api/people";
import { formatEuros, reviewedLabel, statusNote, stepHeading, stepWhen } from "@/lib/records";
import { handlers } from "@/mocks/handlers";
import { exampleCase, exampleInterests, recordDeputy } from "@/mocks/peopleFixtures";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

describe("statusNote (presumption of innocence)", () => {
  it("presumes innocence for suspects, the accused and those sent to trial", () => {
    for (const key of ["arguido", "accused", "sent_to_trial"]) expect(statusNote(key, false)).toBe("Presume-se inocente");
  });

  it("flags a conviction that is not yet final, and only then", () => {
    expect(statusNote("convicted", false)).toBe("Decisão não transitada em julgado");
    expect(statusNote("convicted", true)).toBeNull();
  });

  it("adds nothing to outcomes that clear the person", () => {
    for (const key of ["acquitted", "archived", "not_sent_to_trial", "prescribed"]) expect(statusNote(key, false)).toBeNull();
  });
});

describe("career path", () => {
  const raw = {
    person: { name: "Ana Exemplo", photoUrl: "javascript:alert(1)", party: { slug: "ps", acronym: "PS" }, links: { deputyId: 7 } },
    path: [
      {
        from: "2026-02-09",
        to: null,
        precision: "day",
        title: "Deputada",
        detail: "XVII legislatura",
        kind: "parliament",
        current: true,
        source: "https://parlamento.pt/x",
      },
      { from: "2024-03-26", to: "2025-06-03", precision: "legislature", title: "Deputada", detail: "XVI legislatura", kind: "parliament" },
      { from: "2025-05-18", to: "2025-05-18", precision: "day", title: "Candidata", kind: "election", source: "/elections/x/candidates" },
      { from: null, to: null, title: "Algo novo", kind: "meteor" },
    ],
  };
  const path = mapPersonPath(personPathSchema.parse(raw));

  it("keeps only web addresses as links and unknown kinds as other", () => {
    expect(path.person.photoUrl).toBeNull();
    expect(path.path[0]!.source).toBe("https://parlamento.pt/x");
    expect(path.path[2]!.source).toBeNull();
    expect(path.path[3]!.kind).toBe("other");
    expect(path.person.links).toEqual({ deputyId: 7, governmentMemberId: null, presidentId: null });
    expect(path.records).toEqual({ cases: [], interests: 0 });
  });

  it("shows a legislature by its years, never as exact dates", () => {
    expect(stepHeading(path.path[1]!)).toEqual({ title: "Deputada", detail: "XVI legislatura (2024–2025)", when: null });
    expect(stepWhen(path.path[0]!)).toBe("desde 09-02-2026");
    expect(stepWhen(path.path[2]!)).toBe("18-05-2025");
    expect(stepWhen({ from: "2025-06-03", to: "2025-12-31", precision: "day", current: false })).toBe("03-06-2025 – 31-12-2025");
  });

  it("hides the section instead of failing when the path can't be had", async () => {
    expect(await tryPersonPath("deputy", 999999)).toBeNull();
  });

  it("maps featured people and where their pages are", () => {
    const people = mapFeatured(
      featuredSchema.parse({
        items: [
          { kind: "deputy", id: 6535, name: "A", party: { slug: "chega", acronym: "CH" } },
          { kind: "alien", id: "x", name: "B" },
        ],
      }),
    );
    expect(people).toEqual([
      { kind: "deputy", id: "6535", name: "A", role: null, photoUrl: null, party: { slug: "chega", acronym: "CH" } },
    ]);
    expect(personHref("deputy", "6535")).toBe("/deputados/6535");
    expect(personHref("government", "abc")).toBe("/governo/abc");
    expect(personHref("president", "x")).toBe("/presidente");
  });
});

describe("cases and interests", () => {
  it("puts court and official sources first, keeping their numbers", () => {
    const item = mapCaseDetail(caseDetailSchema.parse(exampleCase));
    expect(item.sources.map((source) => [source.kind, source.position])).toEqual([
      ["court", 2],
      ["news", 1],
    ]);
    expect(item.people[1]).toMatchObject({ status: { key: "convicted" }, final: false, outcome: "3 anos de prisão, suspensa" });
  });

  it("maps a page of cases, defaulting missing lists", () => {
    const page = mapCasePage(
      casePageSchema.parse({ items: [{ id: 2, title: "X", status: { key: "investigation", label: "Em investigação" } }] }),
    );
    expect(page).toMatchObject({ total: 0, items: [{ id: 2, crimes: [], people: [], reviewedAt: null }] });
  });

  it("drops unsafe source links and malformed NIFs", () => {
    const [item] = mapInterests(
      interestsSchema.parse({
        items: [{ ...exampleInterests.items[0], nif: "12ab", source: { url: "javascript:alert(1)", title: "D" }, contracts: null }],
      }),
    );
    expect(item).toMatchObject({ nif: null, source: { url: null, title: "D" }, contracts: null });
  });

  it("asks for the companies with contracts when there is no filter", async () => {
    expect(await getInterests()).toHaveLength(1);
    expect(await getInterests({ deputy: recordDeputy.id })).toHaveLength(1);
    expect(await getInterests({ deputy: 1 })).toHaveLength(0);
  });

  it("formats amounts and review dates", () => {
    expect(formatEuros(150000).replace(/\s/g, " ")).toBe("150 000 €");
    expect(reviewedLabel("2026-11-15")).toBe("Revisto a 15 nov. 2026");
    expect(reviewedLabel(null)).toBeNull();
  });
});

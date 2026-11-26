import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { getPlaceDetail, getPlaces, mapPlaceDetail, placeDetailSchema } from "@/lib/api/places";
import { partyColor } from "@/lib/parliament";
import { electionName, formatEuros, INDEPENDENT_COLOR, initialsOf, mayorColor, mayorLegend, mayorListLabel, PLACE_KEY } from "@/lib/places";
import type { Party } from "@/lib/types";
import { placeHandlers } from "@/mocks/placeFixtures";

const parties: Party[] = [
  { slug: "ps", acronym: "PS", name: "Partido Socialista", website: null },
  { slug: "psd", acronym: "PSD", name: "Partido Social Democrata", website: null },
  { slug: "livre", acronym: "L", name: "LIVRE", website: null },
];

const mayor = (parties: string[]) => ({ id: null, name: "Teresa Exemplo", list: "X", label: "X", parties, election: null });

describe("map colours and legend", () => {
  it("colours a place by the main party of the mayor's list, and citizens' groups alike", () => {
    expect(mayorColor(mayor(["ps", "livre"]))).toBe(partyColor("ps"));
    expect(mayorColor(mayor([]))).toBe(INDEPENDENT_COLOR);
    expect(mayorColor(null)).toBeNull();
  });

  it("counts câmaras per main party, biggest first, independents together", () => {
    const legend = mayorLegend(
      [
        { mayor: mayor(["ps"]) },
        { mayor: mayor(["ps", "livre"]) },
        { mayor: mayor([]) },
        { mayor: mayor([]) },
        { mayor: mayor([]) },
        { mayor: mayor(["mpt"]) },
        { mayor: null },
      ],
      parties,
    );
    expect(legend.map((item) => [item.label, item.count])).toEqual([
      ["Independentes", 3],
      ["PS", 2],
      ["MPT", 1],
    ]);
  });

  it("names the list by our acronyms, or the movement's name in readable case", () => {
    expect(mayorListLabel(mayor(["ps", "livre", "pan"]), parties)).toBe("PS/L/PAN");
    expect(mayorListLabel({ ...mayor([]), label: "AVANÇAR COIMBRA" }, parties)).toBe("Avançar Coimbra");
  });
});

describe("helpers", () => {
  it("formats amounts, initials, election names and keys", () => {
    expect(formatEuros(169_359_370)).toBe("169,4 milhões de euros");
    expect(formatEuros(2_960_305_772)).toBe("3 mil milhões de euros");
    expect(formatEuros(850_000)).toBe("850 mil euros");
    expect(initialsOf("Ana Maria Pereira de Aragão")).toBe("AA");
    expect(electionName("autarquicas-2025")).toBe("Autárquicas 2025");
    expect(PLACE_KEY.test("LOCAL-060300")).toBe(true);
    expect(PLACE_KEY.test("GLOBAL-990000")).toBe(false);
  });
});

describe("place mapper", () => {
  it("fills gaps, sorts seats and parishes, drops unsafe photos and anonymous buyers", () => {
    const place = mapPlaceDetail(
      placeDetailSchema.parse({
        key: "LOCAL-060300",
        name: "Coimbra",
        level: "municipality",
        dicofre: "0603",
        children: [
          { key: "LOCAL-060302", name: "Souselas", level: "parish", dicofre: "060302" },
          { key: "LOCAL-060301", name: "Almalaguês", level: "parish", dicofre: "060301" },
        ],
        council: {
          election: "autarquicas-2025",
          organs: [
            {
              organ: "CM",
              seats: [
                { list: "CH", label: null, parties: ["chega"], votes: 10, validPct: 5, mandates: 1 },
                { list: "PS", label: "PARTIDO SOCIALISTA", parties: ["ps"], votes: 100, validPct: 50, mandates: 6 },
              ],
            },
            { organ: "AM", seats: [] },
          ],
        },
        deputies: {
          circle: { key: "LOCAL-060000", name: "Coimbra" },
          items: [{ id: 1, name: "D", photoUrl: "javascript:alert(1)", party: null }],
        },
        contracts: { carriedOut: null, council: { nif: "", name: "X", count: 1, total: 1, directAwards: 0 } },
      }),
    );
    expect(place.children.map((child) => child.name)).toEqual(["Almalaguês", "Souselas"]);
    expect(place.council?.organs).toHaveLength(1);
    expect(place.council?.organs[0]).toMatchObject({ totalMandates: 7, seats: [{ list: "PS" }, { list: "CH", label: "CH" }] });
    expect(place.deputies?.items[0]?.photoUrl).toBeNull();
    expect(place.contracts.council).toBeNull();
    expect(place.parent).toBeNull();
    expect(place.elections).toEqual([]);
  });
});

describe("who was elected to each body (CNE's official map)", () => {
  const parse = (council: object, more: object = {}) =>
    mapPlaceDetail(placeDetailSchema.parse({ key: "LOCAL-130301", name: "Aião", level: "parish", dicofre: "130301", council, ...more }));
  const organ = (seats: object[]) => ({ election: "autarquicas-2025", organs: [{ organ: "AF", totalMandates: 3, seats }] });
  const seat = (more: object) => ({
    list: "PS",
    label: "PARTIDO SOCIALISTA",
    parties: ["ps"],
    votes: 100,
    validPct: 60,
    mandates: 2,
    ...more,
  });

  it("reads each list's elected in list order, with the president marked and a page only when there is one", () => {
    const place = parse(
      {
        ...organ([
          seat({
            members: [
              { name: "Nome Dois", position: 2, role: null, localOfficialId: null },
              { name: "Nome Um", position: 1, role: "presidente", localOfficialId: "nome-um" },
            ],
          }),
        ]),
        source: { name: "CNE, Mapa Oficial n.º 2-B/2025", url: "https://www.cne.pt/exemplo" },
        asOf: "2025-10-12",
      },
      { juntaPresident: { name: "Nome Um", list: "PS", label: "PARTIDO SOCIALISTA", parties: ["ps"], election: "autarquicas-2025" } },
    );
    expect(place.council?.organs[0]?.seats[0]?.members).toEqual([
      { name: "Nome Um", position: 1, president: true, localOfficialId: "nome-um" },
      { name: "Nome Dois", position: 2, president: false, localOfficialId: null },
    ]);
    expect(place.council).toMatchObject({
      source: { name: "CNE, Mapa Oficial n.º 2-B/2025", url: "https://www.cne.pt/exemplo" },
      asOf: "2025-10-12",
    });
    expect(place.juntaPresident).toMatchObject({ id: null, name: "Nome Um", label: "PARTIDO SOCIALISTA", parties: ["ps"] });
  });

  it("an older API: no names yet (null, not an empty list), no source, no junta president; an unsafe link is dropped", () => {
    const older = parse(organ([seat({})]));
    expect(older.council?.organs[0]?.seats[0]?.members).toBeNull();
    expect(older.council).toMatchObject({ source: null, asOf: null });
    expect(older.juntaPresident).toBeNull();
    const unknownList = parse({ ...organ([seat({ members: [] })]), source: { name: "CNE", url: "javascript:alert(1)" } });
    expect(unknownList.council?.organs[0]?.seats[0]?.members).toEqual([]);
    expect(unknownList.council?.source).toEqual({ name: "CNE", url: null });
  });
});

describe("places API against the mocks", () => {
  const server = setupServer(...placeHandlers);
  beforeAll(() => server.listen());
  afterAll(() => server.close());

  it("lists municipalities with their mayors, and a district's", async () => {
    const all = await getPlaces({ level: "municipality" });
    expect(all.length).toBe(5);
    expect(all.find((place) => place.name === "Sintra")?.mayor?.parties).toEqual([]);
    expect((await getPlaces({ level: "municipality", parent: "LOCAL-110000" })).map((place) => place.name)).toEqual(["Lisboa", "Sintra"]);
  });

  it("answers a place, and 404 for an unknown one", async () => {
    const agueda = await getPlaceDetail("LOCAL-010100");
    expect(agueda.mayor?.name).toBe("Marta Quintela");
    expect(agueda.council?.organs.map((organ) => organ.organ)).toEqual(["CM", "AM"]);
    await expect(getPlaceDetail("LOCAL-999999")).rejects.toBeInstanceOf(ApiError);
  });
});

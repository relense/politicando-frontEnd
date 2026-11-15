import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError, getElectionResult, getElections, getPartyStandings } from "@/lib/api/client";
import { mapElectionResult } from "@/lib/api/mappers";
import { electionResultSchema } from "@/lib/api/schemas";
import {
  chamberOrder,
  electionPath,
  listLabel,
  listName,
  majorityNote,
  mergeSameParties,
  partyStandings,
  resultSentence,
  tidyName,
} from "@/lib/elections";
import { chamberSeats } from "@/lib/hemicycle";
import { sortParties } from "@/lib/parties";
import { standingLabel } from "@/components/PartyOrder";
import type { ElectionList, Party } from "@/lib/types";
import { API, handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const list = (overrides: Partial<ElectionList>): ElectionList => ({
  list: "X",
  name: "X",
  partySlugs: [],
  coalition: false,
  citizens: false,
  votes: 0,
  pct: null,
  validPct: null,
  mandates: null,
  presidents: null,
  ...overrides,
});

const party = (slug: string, acronym: string, name = acronym): Party => ({ slug, acronym, name, website: null });

describe("elections API", () => {
  it("lists elections and filters by type", async () => {
    expect((await getElections()).length).toBe(3);
    const legislativas = await getElections("legislativas");
    expect(legislativas.every((election) => election.type === "legislativas")).toBe(true);
    expect(legislativas.find((election) => !election.imported)?.id).toBe("legislativas-2019");
  });

  it("walks down from the country to a municipality, with a breadcrumb", async () => {
    const top = await getElectionResult("legislativas-2025");
    expect(top.lists.reduce((sum, item) => sum + (item.mandates ?? 0), 0)).toBe(230);
    expect(top.lists[0]!.coalition).toBe(true);
    const district = await getElectionResult("legislativas-2025", { place: "LOCAL-010000" });
    expect(district.breadcrumb.map((place) => place.name)).toEqual(["Território nacional"]);
    expect(district.children.map((child) => child.key)).toContain("LOCAL-010100");
    const municipality = await getElectionResult("legislativas-2025", { place: "LOCAL-010100" });
    expect(municipality.children).toEqual([]);
  });

  it("answers 400 for a body the election lacks and 404 for an unknown one", async () => {
    await expect(getElectionResult("legislativas-2025", { organ: "CM" })).rejects.toMatchObject({ status: 400 });
    await expect(getElectionResult("legislativas-1900")).rejects.toBeInstanceOf(ApiError);
  });

  it("drops unsafe source links", () => {
    const raw = electionResultSchema.parse({
      election: { id: "a-2025", type: "legislativas", name: "A", date: "2025-01-01", sourceUrl: "javascript:alert(1)" },
      organ: "AR",
      place: { key: "GLOBAL-990000", name: "Total", level: "global" },
    });
    expect(mapElectionResult(raw).election.sourceUrl).toBeNull();
  });

  it("builds addresses, leaving the main body out", () => {
    expect(electionPath("legislativas-2025")).toBe("/eleicoes/legislativas-2025");
    expect(electionPath("autarquicas-2021", "LOCAL-010100", "AM")).toBe("/eleicoes/autarquicas-2021/LOCAL-010100?orgao=AM");
  });

  it("uses our party name only for a list that is exactly that party", () => {
    const parties = [party("ps", "PS", "Partido Socialista"), party("pcp", "PCP", "Partido Comunista Português")];
    expect(listName(list({ list: "PS", name: "PS", partySlugs: ["ps"] }), parties)).toBe("Partido Socialista");
    expect(listName(list({ list: "PCP-PEV", name: "CDU", partySlugs: ["pcp"] }), parties)).toBe("CDU");
  });
});

describe("party standings and order", () => {
  it("adds up a party's lists and marks coalition partners", () => {
    const seats = new Map([
      ["psd", 89],
      ["cds-pp", 2],
      ["ps", 58],
      ["jpp", 1],
    ]);
    const standings = partyStandings(seats, [
      list({ name: "AD", partySlugs: ["psd", "cds-pp"], coalition: true, votes: 1_900_000, validPct: 32.5 }),
      list({ name: "PSD/CDS/PPM", partySlugs: ["psd", "cds-pp"], coalition: true, votes: 60_000, validPct: 1 }),
      list({ name: "PS", partySlugs: ["ps"], votes: 1_400_000, validPct: 23.8 }),
    ]);
    expect(standings.psd).toEqual({ seats: 89, votes: 1_960_000, validPct: 33.5, coalition: "AD" });
    expect(standings["cds-pp"]!.seats).toBe(2);
    expect(standings.ps!.coalition).toBeNull();
    expect(standings.jpp).toEqual({ seats: 1, votes: 0, validPct: 0, coalition: null });
    expect(standingLabel(standings.psd)).toBe("89 deputados · em coligação");
    expect(standingLabel(standings.ps)).toBe("58 deputados · 23,8%");
    expect(standingLabel(standings.jpp)).toBe("1 deputado");
  });

  it("orders by seats, then votes, keeping the rest alphabetical; by name changes nothing", () => {
    const parties = [party("a", "A"), party("b", "B"), party("c", "C"), party("d", "D")];
    const standings = {
      b: { seats: 10, votes: 100, validPct: 1, coalition: null },
      c: { seats: 10, votes: 200, validPct: 2, coalition: null },
      d: { seats: 0, votes: 50, validPct: 0.5, coalition: null },
    };
    expect(sortParties(parties, standings, "votes").map((item) => item.slug)).toEqual(["c", "b", "d", "a"]);
    expect(sortParties(parties, standings, "name").map((item) => item.slug)).toEqual(["a", "b", "c", "d"]);
  });

  it("joins seats and votes from the API, and gives up quietly when it fails", async () => {
    const standings = await getPartyStandings();
    expect(standings.psd!.seats).toBe(89);
    expect(standings.psd!.coalition).toBe("AD - Coligação PSD/CDS");
    expect(standings.ps!.votes).toBeGreaterThan(0);
    server.use(http.get(`${API}/elections`, () => HttpResponse.json({ error: { code: "x", message: "x" } }, { status: 500 })));
    expect(await getPartyStandings()).toEqual({});
  });
});

describe("election wording and chamber", () => {
  const parties = [party("ps", "PS", "Partido Socialista"), party("chega", "CH", "CHEGA"), party("psd", "PSD"), party("cds-pp", "CDS-PP")];
  const ad = list({
    list: "PPD/PSD.CDS-PP",
    name: "AD - COLIGAÇÃO PSD/CDS",
    partySlugs: ["psd", "cds-pp"],
    coalition: true,
    votes: 1000,
    validPct: 32.5,
    mandates: 88,
  });
  const adMadeira = list({
    list: "PPD/PSD.CDS-PP.PPM",
    name: "PSD/CDS/PPM",
    partySlugs: ["cds-pp", "psd"],
    coalition: true,
    votes: 50,
    validPct: 1,
    mandates: 3,
  });
  const ch = list({ list: "CH", name: "CHEGA", partySlugs: ["chega"], votes: 900, validPct: 23.7, mandates: 60 });
  const ps = list({ list: "PS", name: "Partido Socialista", partySlugs: ["ps"], votes: 950, validPct: 23.8, mandates: 58 });

  it("tidies names written in capitals, keeping acronyms", () => {
    expect(tidyName("AD - COLIGAÇÃO PSD/CDS")).toBe("AD - Coligação PSD/CDS");
    expect(tidyName("PARTIDO DA TERRA")).toBe("Partido da Terra");
    expect(tidyName("Partido Socialista")).toBe("Partido Socialista");
    expect(listName(ch, parties)).toBe("Chega");
  });

  it("gives short labels for chips", () => {
    expect(listLabel(ad, parties)).toBe("AD");
    expect(listLabel(ps, parties)).toBe("PS");
    expect(listLabel(list({ list: "PCP-PEV", name: "CDU - Coligação Democrática Unitária", partySlugs: ["pcp"] }), parties)).toBe("CDU");
  });

  it("counts AD's two lists as one in the chamber, and orders lists left to right", () => {
    const merged = mergeSameParties([ad, ps, ch, adMadeira]);
    expect(merged.find((item) => item.partySlugs.includes("psd"))).toMatchObject({
      mandates: 91,
      votes: 1050,
      name: "AD - COLIGAÇÃO PSD/CDS",
    });
    expect(chamberOrder(merged).map((item) => item.list)).toEqual(["PS", "PPD/PSD.CDS-PP", "CH"]);
  });

  it("says who won in one sentence", () => {
    const format = (value: number | null) => (value === null ? null : `${String(value).replace(".", ",")}%`);
    expect(resultSentence([ad, ps, ch], parties, 230, format)).toBe(
      "AD - Coligação PSD/CDS venceu com 32,5% dos votos e 88 mandatos, sem maioria absoluta. Seguiram-se Chega (60 mandatos) e Partido Socialista (58).",
    );
    expect(resultSentence([ps, ch], parties, null, format)).toBe(
      "Partido Socialista foi a lista mais votada, com 23,8% dos votos. Seguiu-se Chega (23,7%).",
    );
    expect(majorityNote(120, 230)).toBe("120 de 230 mandatos · maioria absoluta");
    expect(majorityNote(77, 230)).toBe("77 de 230 mandatos · faltaram 39 para a maioria");
  });

  it("draws a chamber of any size with every seat once", () => {
    for (const total of [16, 21, 230]) {
      const { seats, width, height } = chamberSeats(total);
      expect(seats).toHaveLength(total);
      expect(seats.every((seat) => seat.x > 0 && seat.x < width && seat.y > 0 && seat.y <= height)).toBe(true);
    }
    const { seats } = chamberSeats(230);
    // Left to right: the first seats are on the left half, the last on the right.
    expect(seats[0]!.x).toBeLessThan(seats.at(-1)!.x);
  });
});

import { describe, expect, it } from "vitest";
import { mapUrl, nextEventOf, placeLabel, summaryParts, toIcs, type AgendaItem } from "@/lib/agenda";
import { setupServer } from "msw/node";
import { afterAll, beforeAll } from "vitest";
import { getAgenda, getNextEvent, mapAgendaItem } from "@/lib/api/agenda";
import { handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

const base: AgendaItem = {
  id: "x1",
  kind: "parliament",
  title: "Debate; com vírgulas, e tudo",
  summary: "Linha um\nLinha dois",
  start: "2026-11-20T15:00:00Z",
  end: "2026-11-20T18:00:00Z",
  allDay: false,
  status: "scheduled",
  place: { name: "Assembleia da República", address: null, municipality: "Lisboa", district: "Lisboa", lat: null, lng: null },
  online: null,
  attend: { open: true, how: null, url: null },
  organizer: null,
  parties: [],
  sourceUrl: null,
  featured: false,
};

describe("agenda", () => {
  it("writes a calendar file with escaped text and UTC times", () => {
    const ics = toIcs(base, "https://politicando.pt/agenda#evento-x1", new Date("2026-11-16T10:00:00Z"));
    expect(ics).toContain("DTSTART:20261120T150000Z\r\n");
    expect(ics).toContain("DTEND:20261120T180000Z\r\n");
    expect(ics).toContain("SUMMARY:Debate\\; com vírgulas\\, e tudo\r\n");
    expect(ics).toContain("DESCRIPTION:Linha um\\nLinha dois");
    expect(ics).toContain("LOCATION:Assembleia da República\\, Lisboa");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("turns any line break into \\n and folds lines past 75 octets (RFC 5545)", () => {
    const long = "Ponto 1\r\nPonto 2\rPonto 3 " + "á".repeat(80);
    const ics = toIcs({ ...base, summary: long }, "https://politicando.pt/agenda");
    expect(ics).not.toMatch(/\r(?!\n)/);
    const lines = ics.split("\r\n");
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // Unfolded, the text is whole.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:Ponto 1\\nPonto 2\\nPonto 3 " + "á".repeat(80));
  });

  it("gives an all-day event over several days its end as the day after", () => {
    const ics = toIcs({ ...base, allDay: true, start: "2026-11-21", end: "2026-11-23" }, "https://politicando.pt/agenda");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261121");
    expect(ics).toContain("DTEND;VALUE=DATE:20261124");
  });

  it("maps unknown kinds to other, drops unsafe links and reads a bare date as all day", () => {
    const item = mapAgendaItem({
      id: "7",
      kind: "rally",
      title: "T",
      start: "2026-12-01",
      parties: [],
      online: { url: "javascript:alert(1)" },
      sourceUrl: "ftp://x",
    });
    expect(item).toMatchObject({ id: "7", kind: "other", allDay: true, online: null, sourceUrl: null, status: "scheduled" });
  });

  it("links a place to the map by coordinates, else by address", () => {
    expect(mapUrl({ ...base.place!, lat: 38.7, lng: -9.1 })).toContain("mlat=38.7");
    expect(mapUrl(base.place!)).toContain("search?query=Assembleia");
  });

  it("filters by kind and picks the featured event for the front page", async () => {
    const page = await getAgenda({ kinds: ["party"] });
    expect(page?.items.map((item) => item.kind)).toEqual(["party"]);
    expect((await getNextEvent())?.id).toBe("plenario-1");
  });

  it("says each part of a place once", () => {
    const place = {
      name: "Assembleia da República",
      address: "Palácio de São Bento, Lisboa",
      municipality: "Lisboa",
      district: "Lisboa",
      lat: null,
      lng: null,
    };
    expect(placeLabel(place)).toBe("Assembleia da República, Palácio de São Bento, Lisboa");
    const hall = {
      ...place,
      name: "Salão Nobre da Câmara Municipal de Lisboa",
      address: "Salão Nobre da Câmara Municipal de Lisboa, Lisboa",
    };
    expect(placeLabel(hall)).toBe("Salão Nobre da Câmara Municipal de Lisboa");
  });

  it("tidies the Parliament's agenda: no repeated title or hour, speaking times as pairs", () => {
    const title = "Debate na especialidade do Orçamento do Estado para 2027";
    const summary = [
      "ORDEM DO DIA",
      "10H00",
      title,
      "Proposta de Lei n.º 110/XVII/2.ª (GOV)",
      "GOV",
      "120 m",
      "PSD",
      "96 m",
      "Total",
      "216 m",
    ].join("\n");
    expect(summaryParts(summary, title)).toEqual({
      lines: ["Proposta de Lei n.º 110/XVII/2.ª (GOV)"],
      times: [
        { who: "GOV", minutes: 120 },
        { who: "PSD", minutes: 96 },
      ],
      total: 216,
    });
    expect(summaryParts("10h30 - Gonçalo de Oliveira", "Audiências").lines).toEqual(["10h30 - Gonçalo de Oliveira"]);
  });
});

describe("nextEventOf: the front page's «Próximo evento»", () => {
  const at = (id: string, start: string, extra: Partial<AgendaItem> = {}): AgendaItem => ({ ...base, id, start, end: null, ...extra });
  const noon = Date.parse("2026-11-19T12:19:00Z");
  it("skips a timed event that already started and has no end (19 Nov: 10:00 shown past noon)", () => {
    const items = [at("debate", "2026-11-19T10:00:00+00:00"), at("forum", "2026-11-19T12:20:00+00:00")];
    expect(nextEventOf(items, noon)?.id).toBe("forum");
  });
  it("keeps one still running until its end, and all-day ones for the whole day", () => {
    expect(nextEventOf([at("running", "2026-11-19T11:00:00Z", { end: "2026-11-19T13:00:00Z" })], noon)?.id).toBe("running");
    expect(nextEventOf([at("day", "2026-11-19", { allDay: true })], noon)?.id).toBe("day");
    expect(nextEventOf([at("yesterday", "2026-11-18", { allDay: true })], noon)).toBeNull();
  });
  it("prefers the editors' pick among those still to come, and never a cancelled one", () => {
    const items = [
      at("past-pick", "2026-11-19T09:00:00Z", { featured: true }),
      at("cancelled", "2026-11-19T13:00:00Z", { status: "cancelled" }),
      at("next", "2026-11-19T14:00:00Z"),
      at("pick", "2026-11-20T10:00:00Z", { featured: true }),
    ];
    expect(nextEventOf(items, noon)?.id).toBe("pick");
    expect(nextEventOf(items.slice(0, 3), noon)?.id).toBe("next");
  });
});

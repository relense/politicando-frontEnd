import { describe, expect, it } from "vitest";
import {
  mapDeputyDetail,
  mapDeputyVotes,
  mapGovernment,
  mapGovernmentMemberDetail,
  mapInitiative,
  mapInitiativeDetail,
  mapParliament,
} from "@/lib/api/mappers";
import {
  deputyDetailSchema,
  deputyVotesPageSchema,
  governmentMemberDetailSchema,
  governmentSchema,
  initiativeDetailSchema,
  initiativeSchema,
  parliamentSchema,
} from "@/lib/api/schemas";
import { government, governmentMember } from "@/mocks/governmentFixtures";
import { arrangeSeats, facing, focusOf, neighbourSeat, OUTER_RADIUS, polar, seatSpacing } from "@/lib/hemicycle";
import { ageOn, majority, SEAT_ORDER } from "@/lib/parliament";
import { deputyDetail, deputyVotes, initiativeDetails, initiatives, parliament as apiParliament } from "@/mocks/parliamentFixtures";

const parliament = mapParliament(parliamentSchema.parse(apiParliament));
const { seatMap } = parliament;
const focus = focusOf(seatMap);
const spacing = seatSpacing(seatMap.seats);

describe("mock API matches the real API's schemas", () => {
  it("parses the parliament, initiatives and a deputy profile", () => {
    expect(parliament.seatMap.seats).toHaveLength(230);
    expect(parliament.deputies).toHaveLength(230);
    expect(initiatives.every((item) => initiativeSchema.safeParse(item).success)).toBe(true);
    expect(initiativeDetails.every((item) => initiativeDetailSchema.safeParse(item).success)).toBe(true);
    expect(deputyDetailSchema.safeParse(deputyDetail(1000, [])).success).toBe(true);
  });

  it("seats every party as many times as it has deputies", () => {
    for (const group of parliament.groups) {
      expect(seatMap.seats.filter((seat) => seat.partySlug === group.party.slug)).toHaveLength(group.seats);
      expect(parliament.deputies.filter((deputy) => deputy.partySlug === group.party.slug)).toHaveLength(group.seats);
    }
  });
});

describe("seat map geometry", () => {
  it("sizes seats from the real gaps and turns them towards the Mesa", () => {
    expect(spacing).toBeGreaterThan(0.02);
    expect(spacing).toBeLessThan(0.05);
    expect(facing({ x: focus.x, y: 0 }, focus)).toBeCloseTo(0);
    expect(facing({ x: 0, y: focus.y }, focus)).toBeCloseTo(-90);
    expect(facing({ x: seatMap.width, y: focus.y }, focus)).toBeCloseTo(90);
  });

  it("moves along the same row with left and right", () => {
    for (const seat of seatMap.seats) {
      const here = polar(seat, focus);
      for (const direction of ["left", "right"] as const) {
        const next = neighbourSeat(seatMap.seats, seat, direction, focus, spacing);
        if (!next) continue;
        const there = polar(next, focus);
        expect(Math.abs(there.radius - here.radius)).toBeLessThanOrEqual(spacing / 2);
        expect(direction === "left" ? there.angle > here.angle : there.angle < here.angle).toBe(true);
      }
    }
  });

  it("moves to the row behind or in front with up and down", () => {
    const front = [...seatMap.seats].sort((a, b) => polar(a, focus).radius - polar(b, focus).radius)[0]!;
    const back = neighbourSeat(seatMap.seats, front, "back", focus, spacing)!;
    expect(polar(back, focus).radius).toBeGreaterThan(polar(front, focus).radius);
    expect(neighbourSeat(seatMap.seats, front, "front", focus, spacing)).toBeUndefined();
  });
});

describe("parliament mappers and helpers", () => {
  it("upgrades the Parliament's http links and strips markup from titles", () => {
    const initiative = mapInitiative(initiativeSchema.parse({ ...initiatives[0]!, title: "Lei &amp; <b>ordem</b>" }));
    expect(initiative.title).toBe("Lei & ordem");
    expect(initiative.textUrl).toMatch(/^https:\/\//);
    const unsafe = mapInitiative(initiativeSchema.parse({ ...initiatives[0]!, textUrl: "javascript:alert(1)" }));
    expect(unsafe.textUrl).toBeNull();
  });

  it("keeps split votes: a number means only that many of the group's deputies", () => {
    const detail = mapInitiativeDetail(initiativeDetailSchema.parse(initiativeDetails[0]!));
    expect(detail.votes[0]!.against).toContainEqual({ partySlug: "ps", count: 1 });
    expect(detail.votes[0]!.named).toHaveLength(1);
  });

  it("fills a deputy profile with safe defaults when extras are missing", () => {
    const sparse = deputyDetailSchema.parse({ ...deputyDetail(1000, [])!, education: null, committees: undefined, partyInfo: null });
    const detail = mapDeputyDetail(sparse);
    expect(detail.education).toEqual([]);
    expect(detail.committees).toEqual([]);
    expect(detail.party).toBeNull();
  });

  it("knows the majority and a deputy's age", () => {
    expect(majority(230)).toBe(116);
    const now = new Date(2026, 10, 15);
    expect(ageOn("1978-11-11", now)).toBe(48);
    expect(ageOn("1978-11-20", now)).toBe(47);
    expect(ageOn(null, now)).toBeNull();
  });
});

describe("arrangeSeats", () => {
  const layout = arrangeSeats(seatMap.seats, focus, SEAT_ORDER);
  const centre = focusOf(layout);

  it("keeps every official seat once, with its number and party", () => {
    expect(layout.seats).toHaveLength(230);
    expect(new Set(layout.seats.map((seat) => seat.number)).size).toBe(230);
    for (const seat of layout.seats) {
      expect(seatMap.seats.find((official) => official.number === seat.number)!.partySlug).toBe(seat.partySlug);
    }
  });

  it("draws a half ring with no overlapping seats, inside the box", () => {
    const gap = seatSpacing(layout.seats);
    expect(gap).toBeGreaterThan(OUTER_RADIUS / 20);
    for (const seat of layout.seats) {
      const { radius, angle } = polar(seat, centre);
      expect(radius).toBeLessThanOrEqual(OUTER_RADIUS + 0.001);
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeLessThan(Math.PI);
      expect(seat.x).toBeGreaterThan(0);
      expect(seat.x).toBeLessThan(layout.width);
    }
  });

  it("puts the parties left to right in the given order", () => {
    const meanAngle = (slug: string) => {
      const angles = layout.seats.filter((seat) => seat.partySlug === slug).map((seat) => polar(seat, centre).angle);
      return angles.reduce((a, b) => a + b, 0) / angles.length;
    };
    expect(meanAngle("ps")).toBeGreaterThan(meanAngle("psd"));
    expect(meanAngle("psd")).toBeGreaterThan(meanAngle("chega"));
    expect(meanAngle("pcp")).toBeGreaterThan(meanAngle("ps"));
  });
});

describe("Government and votes", () => {
  it("parses the Government, linking a minister who came from Parliament to their deputy record", () => {
    const parsed = mapGovernment(governmentSchema.parse(government));
    expect(parsed.primeMinister?.kind).toBe("prime_minister");
    expect(parsed.ministries[0]!.area).toBe("primeiro-ministro");
    const fromParliament = parsed.ministries.flatMap((ministry) => (ministry.minister ? [ministry.minister] : [])).find((m) => m.deputyId);
    expect(fromParliament?.partySlug).toBe("psd");
    expect(parsed.former[0]!.endDate).toBe("2026-02-11");
  });

  it("parses a member's page and drops unsafe links", () => {
    const raw = governmentMember(parsedId(), [])!;
    const member = mapGovernmentMemberDetail(
      governmentMemberDetailSchema.parse({ ...raw, links: [...raw.links!, { network: "Mau", url: "javascript:alert(1)" }] }),
    );
    expect(member.links.every((link) => link.url.startsWith("https://"))).toBe(true);
    expect(member.positions[0]!.title).toBe("Primeiro-Ministro");
  });

  it("works out a deputy's votes from their group, naming those who broke ranks", () => {
    const deputy = parliament.deputies.find((item) => item.partySlug === "ps")!;
    const page = mapDeputyVotes(deputyVotesPageSchema.parse({ ...deputyVotes(deputy.id)!, nextCursor: null }));
    expect(page.votes.length).toBeGreaterThan(0);
    expect(page.votes.every((vote) => (vote.position === null) === (vote.basis === "absent" || vote.basis === "unknown"))).toBe(true);
    const { favor, against, abstention, absent, unknown } = page.summary;
    expect(favor + against + abstention + absent + unknown).toBe(page.votes.length);
  });

  it("reads coverage and absent groups on initiatives", () => {
    const detail = mapInitiativeDetail(initiativeDetailSchema.parse({ ...initiativeDetails[0]!, articles: [] }));
    expect(detail.coverage.articles).toBe(3);
    expect(detail.votes[0]!.absent).toEqual([{ partySlug: "jpp", count: null }]);
  });
});

function parsedId() {
  return governmentSchema.parse(government).primeMinister!.id;
}

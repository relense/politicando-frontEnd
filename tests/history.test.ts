import { describe, expect, it } from "vitest";
import { mapGovernmentHistory, mapTimeline } from "@/lib/api/mappers";
import { governmentHistorySchema, timelineSchema } from "@/lib/api/schemas";
import { daysLabel, decadeLabel, decadeTicks, durationLabel, endTone, historyStats, spanOnAxis, timelineByDecade } from "@/lib/history";
import { governmentHistory, timeline } from "@/mocks/historyFixtures";

const history = mapGovernmentHistory(governmentHistorySchema.parse(governmentHistory));
const events = mapTimeline(timelineSchema.parse(timeline));

describe("history API", () => {
  it("maps governments and keeps the current one", () => {
    expect(history.governments).toHaveLength(6);
    const current = history.governments[0]!;
    expect(current).toMatchObject({ code: "gc25", current: true, end: null, endReason: "in_office", kind: "constitutional" });
    expect(history.governments.at(-1)).toMatchObject({ kind: "provisional", parties: [] });
  });

  it("drops end reasons and timeline kinds it doesn't know", () => {
    const odd = mapGovernmentHistory(
      governmentHistorySchema.parse({ items: [{ ...governmentHistory.items[1], endReason: "meteor" }], source: "javascript:alert(1)" }),
    );
    expect(odd.governments[0]!.endReason).toBeNull();
    expect(odd.source).toBeNull();
    expect(events.map((event) => event.kind)).toEqual(["president", "election", "election", "president"]);
    expect(events[1]!.electionId).toBe("legislativas-2025");
    expect(events[2]!.electionId).toBeNull();
  });
});

describe("history wording", () => {
  it("says how long a government lasted in calendar months", () => {
    expect(durationLabel("2024-04-02", "2025-06-05")).toBe("1 ano e 2 meses");
    expect(durationLabel("1975-08-08", "1975-09-19")).toBe("1 mês");
    expect(durationLabel("1975-08-08", "1975-09-01")).toBe("24 dias");
    expect(durationLabel("2019-10-26", "2023-10-26")).toBe("4 anos");
    expect(durationLabel("2019-10-26", "2023-10-25")).toBe("3 anos e 11 meses");
    expect(daysLabel(429)).toBe("1 ano e 2 meses");
    expect(daysLabel(1)).toBe("1 dia");
  });

  it("tells a government that lasted from one Parliament brought down", () => {
    expect(endTone("end_of_term")).toBe("lasted");
    expect(endTone("censure")).toBe("fell");
    expect(endTone("confidence_rejected")).toBe("fell");
    expect(endTone("early_election")).toBe("early");
    expect(endTone("in_office")).toBe("current");
    expect(endTone(null)).toBe("unknown");
  });

  it("counts governments, full terms and falls", () => {
    const stats = historyStats(history.governments);
    expect(stats).toMatchObject({ total: 6, provisional: 1, constitutional: 5, ended: 4, lasted: 1, fell: 2 });
    expect(stats.longest?.code).toBe("gc23");
    expect(stats.shortest?.code).toBe("gc02");
  });

  it("names decades and groups the line by them, newest first", () => {
    expect(decadeLabel("1974-05-16")).toBe("Anos 70");
    expect(decadeLabel("2005-03-12")).toBe("Anos 2000");
    const decades = timelineByDecade(history.governments, events);
    expect(decades.map((decade) => decade.label)).toEqual(["Anos 2020", "Anos 2010", "Anos 70"]);
    expect(decades[0]!.entries[0]).toMatchObject({ kind: "event", date: "2026-03-09" });
  });

  it("places spans on the axis", () => {
    expect(spanOnAxis("2000-01-01", "2010-01-01", "2000-01-01", "2020-01-01").left).toBe(0);
    const middle = spanOnAxis("2010-01-01", "2020-01-01", "2000-01-01", "2020-01-01");
    expect(middle.left).toBeCloseTo(50, 0);
    expect(middle.width).toBeCloseTo(50, 0);
    expect(decadeTicks("1974-04-25", "2026-11-15")).toEqual([1980, 1990, 2000, 2010, 2020]);
  });
});

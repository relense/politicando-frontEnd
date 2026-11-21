import { describe, expect, it } from "vitest";
import { freshnessLine } from "@/lib/api/stories";

// Thursday 19 November 2026, 08:00 in Lisbon (UTC in winter).
const now = Date.parse("2026-11-19T08:00:00Z");
const story = (recentSourceCount: number | null, firstPublishedAt: string, lastPublishedAt: string) => ({
  recentSourceCount,
  firstPublishedAt,
  lastPublishedAt,
});

describe("Hoje em 5: how fresh each story is", () => {
  it("says the outlets of the last 24 hours and the latest article's age", () => {
    expect(freshnessLine(story(4, "2026-11-19T05:00:00Z", "2026-11-19T06:00:00Z"), now)).toBe("4 jornais · há 2 h");
    expect(freshnessLine(story(1, "2026-11-19T07:40:00Z", "2026-11-19T07:40:00Z"), now)).toBe("1 jornal · há 20 min");
  });

  it("adds when a story began before today", () => {
    expect(freshnessLine(story(2, "2026-11-18T12:41:00Z", "2026-11-19T01:30:00Z"), now)).toBe("2 jornais · há 6 h · desde ontem");
    expect(freshnessLine(story(3, "2026-11-17T02:15:00Z", "2026-11-18T18:27:00Z"), now)).toBe("3 jornais · há 13 h · desde terça");
  });

  it("leaves the count out when an older API doesn't send it", () => {
    expect(freshnessLine(story(null, "2026-11-18T12:41:00Z", "2026-11-19T01:30:00Z"), now)).toBe("há 6 h · desde ontem");
    // The day after the clocks go forward (29 March 2026 has 23 hours): 24 hours back is still the 28th.
    const afterChange = Date.parse("2026-03-29T23:30:00Z"); // 00:30 on the 30th in Lisbon
    expect(freshnessLine(story(null, "2026-03-29T10:00:00Z", "2026-03-29T22:00:00Z"), afterChange)).toBe("há 1 h · desde ontem");
  });
});

describe("story lists", () => {
  it("leave out a story with no version left, which has nothing to show or open", async () => {
    const { storyListSchema } = await import("@/lib/api/stories");
    const story = (id: number, sources: unknown[]) => ({
      id,
      title: "T",
      imageUrl: null,
      firstPublishedAt: "2026-11-19T05:00:00Z",
      lastPublishedAt: "2026-11-19T06:00:00Z",
      articleCount: sources.length,
      sourceCount: sources.length,
      sources,
      parties: [],
      importa: 0,
      importance: 0,
      commentCount: 0,
    });
    const source = { name: "Público", articleId: 9, title: "T", url: "https://publico.pt/x", publishedAt: "2026-11-19T06:00:00Z" };
    const parsed = storyListSchema.safeParse([story(1, [source]), story(2, [])]);
    expect(parsed.success && parsed.data.map((item) => item.id)).toEqual([1]);
  });
});

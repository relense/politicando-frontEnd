import { describe, expect, it } from "vitest";
import { fitsFeed, hasNewer, newestOf } from "@/lib/feedFreshness";

const articles = (...dates: string[]) => ({ articles: dates.map((publishedAt, id) => ({ id, publishedAt })), nextCursor: null });
const stories = (...dates: string[]) => ({
  stories: dates.map((lastPublishedAt, id) => ({ id, lastPublishedAt })),
  nextCursor: null,
  total: null,
});

describe("Há notícias novas: is there news newer than what the reader has?", () => {
  it("reads the newest date of articles or of stories (the latest article of each)", () => {
    expect(newestOf([articles("2026-11-19T08:00:00Z", "2026-11-19T09:30:00Z")])).toBe(Date.parse("2026-11-19T09:30:00Z"));
    expect(newestOf([stories("2026-11-19T07:00:00Z"), stories("2026-11-19T10:00:00Z")])).toBe(Date.parse("2026-11-19T10:00:00Z"));
    expect(newestOf([articles()])).toBeNull();
  });
  it("yes when the fresh first page has something newer, a story with a new article included", () => {
    expect(hasNewer([articles("2026-11-19T09:00:00Z")], articles("2026-11-19T10:00:00Z", "2026-11-19T09:00:00Z"))).toBe(true);
    expect(hasNewer([stories("2026-11-19T09:00:00Z")], stories("2026-11-19T09:05:00Z"))).toBe(true);
  });
  it("no when nothing is newer, the fresh page is empty, or a date can't be read", () => {
    expect(hasNewer([articles("2026-11-19T10:00:00Z")], articles("2026-11-19T10:00:00Z"))).toBe(false);
    expect(hasNewer([articles("2026-11-19T10:00:00Z")], articles())).toBe(false);
    expect(hasNewer([articles("2026-11-19T10:00:00Z")], articles("not a date"))).toBe(false);
  });
});

describe("a fresh page is offered only when it fits the feed the reader is on", () => {
  const article = (slugs: string[], sourceDomain = "publico.pt") => ({
    id: 1,
    publishedAt: "2026-11-19T10:00:00Z",
    parties: slugs.map((slug) => ({ slug })),
    sourceDomain,
  });
  const story = (slugs: string[], domains: string[]) => ({
    id: 1,
    lastPublishedAt: "2026-11-19T10:00:00Z",
    parties: slugs.map((slug) => ({ slug })),
    versions: domains.map((sourceDomain) => ({ sourceDomain })),
  });
  it("every item names one of the chosen parties (19 Nov: PPM's feed was replaced by every party's news)", () => {
    expect(fitsFeed({ articles: [article(["ppm", "psd"]), article(["ppm"])] }, { parties: ["ppm"], sources: [] })).toBe(true);
    expect(fitsFeed({ articles: [article(["ppm"]), article(["ps", "chega"])] }, { parties: ["ppm"], sources: [] })).toBe(false);
    expect(fitsFeed({ stories: [story(["ps"], ["publico.pt"])] }, { parties: ["ppm", "ps"], sources: [] })).toBe(true);
  });
  it("and comes from one of the chosen outlets", () => {
    expect(fitsFeed({ articles: [article(["ps"], "expresso.pt")] }, { parties: [], sources: ["publico.pt"] })).toBe(false);
    expect(fitsFeed({ stories: [story(["ps"], ["expresso.pt", "publico.pt"])] }, { parties: [], sources: ["publico.pt"] })).toBe(true);
  });
  it("anything fits the unfiltered feed", () => {
    expect(fitsFeed({ articles: [article([])] }, { parties: [], sources: [] })).toBe(true);
  });
});

it("an empty feed never offers «Há notícias novas»", () => {
  expect(hasNewer([articles()], articles("2026-11-19T10:00:00Z"))).toBe(false);
});

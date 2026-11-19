import { describe, expect, it } from "vitest";
import { hasNewer, newestOf } from "@/lib/feedFreshness";

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
  it("yes when the reader's feed was empty and news arrived", () => {
    expect(hasNewer([articles()], articles("2026-11-19T10:00:00Z"))).toBe(true);
  });
});

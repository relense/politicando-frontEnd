import { describe, expect, it } from "vitest";
import { CACHE_TAGS, tagsFor } from "@/lib/api/cacheTags";

describe("what each cached request is tagged with, for the backend's ping (POST /api/revalidate)", () => {
  it("news: stories, Hoje em 5, articles and the sitemap", () => {
    for (const path of ["/stories?limit=20", "/stories/472", "/today", "/articles?limit=20&party=ps", "/articles/100", "/sitemap/articles"])
      expect(tagsFor(path)).toEqual(["news"]);
  });
  it("the podcast, the agenda, the blog and the Parliament", () => {
    expect(tagsFor("/podcast/latest")).toEqual(["podcast"]);
    expect(tagsFor("/podcast?limit=11")).toEqual(["podcast"]);
    expect(tagsFor("/agenda?from=2026-11-19")).toEqual(["agenda"]);
    expect(tagsFor("/editorial?limit=50")).toEqual(["blog"]);
    for (const path of ["/parliament", "/deputies/1", "/initiatives?party=ps", "/parties/ps/votes?limit=20", "/legislatures"])
      expect(tagsFor(path)).toEqual(["parliament"]);
  });
  it("nothing for the rest", () => {
    expect(tagsFor("/elections")).toEqual([]);
    expect(tagsFor("/me")).toEqual([]);
  });
  it("names the six the backend sends (docs/revalidate.md)", () => {
    expect([...CACHE_TAGS].sort()).toEqual(["agenda", "blog", "budget", "news", "parliament", "podcast"]);
  });
});

describe("request() tags its cached requests", () => {
  it("adds the tag to a cached request, keeping its own, and none to an uncached one", async () => {
    const { vi } = await import("vitest");
    const { z } = await import("zod");
    const calls: RequestInit[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      calls.push(init ?? {});
      return new Response("{}", { status: 200 });
    });
    const { request } = await import("@/lib/api/client");
    await request("/stories?limit=20", z.object({}), { next: { revalidate: 60 } });
    await request("/editorial", z.object({}), { next: { revalidate: 60, tags: ["mine"] } } as { next: { revalidate: number } });
    await request("/stories/1/comments", z.object({}), { cache: "no-store" });
    spy.mockRestore();
    const tags = (init: RequestInit) => (init as { next?: { tags?: string[] } }).next?.tags;
    expect(tags(calls[0]!)).toEqual(["news"]);
    expect(tags(calls[1]!)).toEqual(["mine", "blog"]);
    expect(tags(calls[2]!)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { breadcrumbs, clip, filteredListRobots, jsonLd } from "@/lib/seo";

describe("seo helpers", () => {
  it("clips long descriptions at a word, with an ellipsis", () => {
    const text = "palavra ".repeat(40);
    const clipped = clip(text);
    expect(clipped.length).toBeLessThanOrEqual(155);
    expect(clipped.endsWith("palavra…")).toBe(true);
    expect(clip("  curta   e   simples ")).toBe("curta e simples");
  });

  it("escapes < in JSON-LD so text can't close the script tag", () => {
    expect(jsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("<");
  });

  it("numbers breadcrumbs from 1 with absolute links", () => {
    const list = breadcrumbs([
      { name: "Parlamento", path: "/parlamento" },
      { name: "Ana", path: "/deputados/1" },
    ]);
    expect(list.itemListElement.map((item) => item.position)).toEqual([1, 2]);
    expect(list.itemListElement[1]!.item).toMatch(/^https?:\/\/.+\/deputados\/1$/);
  });

  // Google Search Console, 23 Nov: thousands of party × topic × stage lists, each its own page, near-duplicates.
  it("a list is indexed alone or with one filter; a search, a combination or a narrowing filter is kept out (links still followed)", () => {
    expect(filteredListRobots({ filters: [] })).toBeUndefined();
    expect(filteredListRobots({ filters: ["psd", null] })).toBeUndefined();
    expect(filteredListRobots({ filters: ["psd", "digital"] })).toEqual({ index: false, follow: true });
    expect(filteredListRobots({ filters: [null], narrowing: true })).toEqual({ index: false, follow: true });
    expect(filteredListRobots({ filters: [], search: "irs" })).toEqual({ index: false, follow: true });
  });
});

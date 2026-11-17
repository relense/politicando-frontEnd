import { describe, expect, it } from "vitest";
import { breadcrumbs, clip, jsonLd } from "@/lib/seo";

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
});

import { describe, expect, it } from "vitest";
import { inputOf, problemsOf, tagsOf } from "@/components/admin/PostEditor";

const fields = {
  title: "  O que muda no IRS  ",
  subtitle: " ",
  slug: "",
  kind: "article" as const,
  body: "Texto",
  authorName: "",
  coverImageUrl: "",
  mediaUrl: "",
  tags: "IRS, orçamento, irs, ",
};

describe("the post editor", () => {
  it("sends blanks as null and tags once each, in lower case", () => {
    expect(inputOf(fields)).toEqual({
      title: "O que muda no IRS",
      subtitle: null,
      slug: null,
      kind: "article",
      body: "Texto",
      authorName: null,
      coverImageUrl: null,
      mediaUrl: null,
      tags: ["irs", "orçamento"],
    });
    expect(tagsOf("")).toEqual([]);
  });

  it("checks the API's rules before sending", () => {
    expect(problemsOf(fields)).toEqual({});
    const problems = problemsOf({
      ...fields,
      title: "Um",
      slug: "Com Acentos-é",
      coverImageUrl: "http://exemplo.pt/a.jpg",
      mediaUrl: "nada",
      tags: Array.from({ length: 11 }, (_, index) => `t${index}`).join(","),
    });
    expect(Object.keys(problems).sort()).toEqual(["coverImageUrl", "mediaUrl", "slug", "tags", "title"]);
    expect(problemsOf({ ...fields, slug: "o-que-muda-no-irs-2" })).toEqual({});
  });
});

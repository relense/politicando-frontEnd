import { describe, expect, it } from "vitest";
import { commentPlace, type AdminComment } from "@/lib/api/admin";

const base: AdminComment = {
  id: 1,
  articleId: null,
  articleTitle: null,
  storyId: null,
  storyTitle: null,
  postSlug: null,
  postTitle: null,
  parentId: null,
  username: null,
  body: "x",
  createdAt: "2026-11-20T10:00:00Z",
  hiddenAt: null,
};

describe("commentPlace: where a moderated comment is", () => {
  it("a news article, a story or a blog post; nothing when the API doesn't say", () => {
    expect(commentPlace({ ...base, articleId: 12, articleTitle: "A" })).toEqual({ href: "/article/12#comentarios", label: "A" });
    expect(commentPlace({ ...base, storyId: 41 })).toEqual({ href: "/historias/41#comentarios", label: "História #41" });
    expect(commentPlace({ ...base, postSlug: "o-orcamento", postTitle: "O Orçamento" })).toEqual({
      href: "/editorial/o-orcamento#comentarios",
      label: "O Orçamento",
    });
    expect(commentPlace(base)).toBeNull();
  });
});

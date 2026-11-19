import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForumText } from "@/components/forum/ForumText";
import { ApiError } from "@/lib/api/client";
import { forumErrorMessage, mapThreadDetail, mapThreadLink, mapThreadSummary, posterName } from "@/lib/api/forums";
import { quotesOf, splitForumText } from "@/lib/forumText";

describe("splitForumText", () => {
  it("finds web addresses, leaving the sentence's punctuation outside", () => {
    expect(splitForumText("Vê https://example.org/a?b=1. Obrigado")).toEqual([
      { kind: "text", text: "Vê " },
      { kind: "url", url: "https://example.org/a?b=1", text: "https://example.org/a?b=1" },
      { kind: "text", text: ". Obrigado" },
    ]);
  });

  it("never turns other schemes into links", () => {
    const parts = splitForumText("javascript:alert(1) data:text/html,x ftp://x.pt");
    expect(parts.every((part) => part.kind === "text")).toBe(true);
  });

  it("finds >>quotes", () => {
    expect(splitForumText(">>31\nConcordo com >>32")).toEqual([
      { kind: "quote", id: 31 },
      { kind: "text", text: "\nConcordo com " },
      { kind: "quote", id: 32 },
    ]);
    expect(quotesOf(">>31 e >>31 e >>40")).toEqual([31, 40]);
    expect(quotesOf(null)).toEqual([]);
  });
});

describe("ForumText", () => {
  it("shows HTML as text and links only http(s), with nofollow ugc", () => {
    const { container } = render(
      <ForumText body={'<img src=x onerror="alert(1)"> https://example.org >>31 >>99'} anchors={new Map([[31, "post-31"]])} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    const link = screen.getByRole("link", { name: "https://example.org" });
    expect(link.getAttribute("rel")).toBe("nofollow ugc noopener");
    expect(screen.getByRole("link", { name: ">>31" }).getAttribute("href")).toBe("#post-31");
    // A quote of a post that isn't here is not a link.
    expect(screen.queryByRole("link", { name: ">>99" })).toBeNull();
  });
});

describe("forum mappers", () => {
  const base = {
    id: 7,
    board: "ps",
    title: "Orçamento",
    nickname: null,
    posterId: "Xk3_a9Qz",
    replyCount: 2,
    createdAt: "2026-11-15T10:00:00.000Z",
    bumpedAt: "2026-11-15T11:00:00.000Z",
    pinned: false,
    locked: false,
  };

  it("keeps one link: the article, else the initiative", () => {
    expect(mapThreadLink(null)).toBeNull();
    expect(mapThreadLink({ article: { id: 12, title: "A" }, initiative: null })).toEqual({ kind: "article", id: 12, title: "A" });
    expect(mapThreadLink({ article: null, initiative: { id: 3, title: "I" } })).toEqual({ kind: "initiative", id: 3, title: "I" });
    expect(mapThreadSummary({ ...base, excerpt: "x", link: undefined }).link).toBeNull();
    expect(mapThreadDetail({ thread: { ...base, body: "x", link: null }, posts: [], hasMore: false }).thread.link).toBeNull();
  });

  it("names anonymous posters and explains failures", () => {
    expect(posterName(null)).toBe("Anónimo");
    expect(posterName("  ")).toBe("Anónimo");
    expect(posterName("Zé")).toBe("Zé");
    expect(forumErrorMessage(new ApiError("x", 409, "thread_locked"))).toMatch(/fechada/);
    expect(forumErrorMessage(new ApiError("x", 429, "rate_limited"))).toMatch(/depressa/);
    expect(forumErrorMessage(new ApiError("body/nickname That name is the team's", 400, "invalid_request"))).toMatch(/reservado/);
    expect(forumErrorMessage(new Error("x"))).toMatch(/Não foi possível/);
  });
});

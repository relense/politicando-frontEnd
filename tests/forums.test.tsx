import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForumText } from "@/components/forum/ForumText";
import { ApiError } from "@/lib/api/client";
import { forumErrorMessage, mapThreadDetail, mapThreadLink, mapThreadSummary, posterName } from "@/lib/api/forums";
import { notificationHref, notificationText } from "@/lib/notifications";
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

  it("an idea's new fields: followers, expected date, duplicate, area, the status timeline; an older API reads as empty", () => {
    const idea = {
      ...base,
      board: "ideias",
      excerpt: "x",
      score: 48,
      status: "duplicate",
      followers: 23,
      expectedOn: "2026-11-27",
      duplicateOf: { id: 12, title: "Modo escuro" },
      area: "Newsletter",
    };
    expect(mapThreadSummary(idea)).toMatchObject({
      status: "duplicate",
      followers: 23,
      expectedOn: "2026-11-27",
      duplicateOf: { id: 12, title: "Modo escuro" },
      area: "Newsletter",
    });
    expect(mapThreadSummary({ ...base, excerpt: "x", status: "something_new" })).toMatchObject({
      status: null,
      followers: null,
      expectedOn: null,
      duplicateOf: null,
      area: null,
    });
    const history = [
      { status: null, at: "2026-11-14T10:00:00.000Z" },
      { status: "reviewing", at: "2026-11-15T10:00:00.000Z" },
      { status: "nonsense", at: "2026-11-16T10:00:00.000Z" },
    ];
    const detail = mapThreadDetail({
      thread: { ...base, board: "ideias", body: "x", statusHistory: history },
      posts: [
        {
          id: 31,
          body: "Ok",
          nickname: "Politicando",
          posterId: "equipa",
          isOp: false,
          replyTo: null,
          createdAt: base.createdAt,
          hidden: false,
          team: true,
          score: 4,
        },
        { id: 32, body: "Ok", nickname: null, posterId: "a", isOp: false, replyTo: null, createdAt: base.createdAt, hidden: false },
      ],
      hasMore: false,
    });
    // An unknown status in the history is left out, not guessed.
    expect(detail.thread.statusHistory).toEqual([
      { status: null, at: "2026-11-14T10:00:00.000Z" },
      { status: "reviewing", at: "2026-11-15T10:00:00.000Z" },
    ]);
    expect(detail.posts.map((post) => [post.team, post.score])).toEqual([
      [true, 4],
      [false, 0],
    ]);
  });

  it("the inbox line when the team changes an idea's status, leading to the idea", () => {
    const item = {
      id: 1,
      kind: "idea_status",
      actorName: null,
      count: 1,
      createdAt: "2026-11-20T10:00:00.000Z",
      read: false,
      snippet: null,
      link: {
        commentId: null,
        articleId: null,
        storyId: null,
        postSlug: null,
        threadId: 501,
        postId: null,
        initiativeId: null,
        feedbackId: null,
      },
      threadTitle: "Alertas do meu distrito",
      board: "ideias",
      headline: null,
      prediction: null,
      status: "planned",
    };
    expect(notificationText(item).lead).toBe("A ideia que segues, “Alertas do meu distrito”, está agora: Planeada");
    expect(notificationHref(item)).toBe("/feedback/ideias/501");
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

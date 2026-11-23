import { beforeEach, describe, expect, it } from "vitest";
import { passwordStrength } from "@/components/account/AuthPage";
import { itemsOf } from "@/components/account/AccountSettings";
import { applyAccountState, clearLocalState, localStateToMerge } from "@/lib/account";
import { ApiError } from "@/lib/api/client";
import { accountErrorMessage, emailProblem, registerAnswerSchema, safeReturn, userSchema, type AccountState } from "@/lib/api/account";
import { readerPrefs } from "@/lib/readerPrefs";
import { currentExtras } from "@/lib/accountExtras";

const state: AccountState = {
  saved: { articles: [812, 790], stories: [41], editorial: [3], comments: [1203], threads: [17], replies: [4410] },
  follows: { stories: [41], threads: [17], budgetProposals: [25391] },
  hidden: [777],
  muted: { sources: ["publico.pt"], parties: ["chega"] },
  read: [41, 39],
  votes: {
    articles: { "812": 1, "640": -1 },
    editorial: { "metodo-de-hondt": 1 },
    stories: [41],
    comments: [1203],
    forum: [17],
    forumPosts: [880],
  },
};

describe("the account in the browser", () => {
  beforeEach(() => window.localStorage.clear());

  it("fills this browser's lists from the account, oldest first as the browser keeps them", () => {
    applyAccountState(state);
    expect(readerPrefs()).toEqual({ saved: [790, 812], hidden: [777], mutedSources: ["publico.pt"], mutedParties: ["chega"] });
    expect(JSON.parse(window.localStorage.getItem("article-votes")!)).toEqual({ "812": 1, "640": -1, "post:metodo-de-hondt": 1 });
    expect(JSON.parse(window.localStorage.getItem("story-importa")!)).toEqual({ "41": 1 });
    expect(JSON.parse(window.localStorage.getItem("comment-likes")!)).toEqual([1203]);
    expect(window.localStorage.getItem("ideas-voted")).toBe("17");
    expect(window.localStorage.getItem("idea-replies-voted")).toBe("880");
    expect(JSON.parse(window.localStorage.getItem("stories-read")!)).toEqual([39, 41]);
    // What only the account keeps: follows and the other saved things.
    expect(currentExtras()).toEqual({
      follows: { story: [41], thread: [17], budget_proposal: [25391] },
      saved: { editorial: [3], comment: [1203], thread: [17], reply: [4410] },
    });
    // And sends them back newest first, without votes, to merge.
    expect(localStateToMerge()).toEqual({
      saved: { articles: [812, 790], stories: [] },
      hidden: [777],
      muted: { sources: ["publico.pt"], parties: ["chega"] },
      read: [41, 39],
    });
  });

  it("empties them on logging out", () => {
    applyAccountState(state);
    clearLocalState();
    expect(readerPrefs()).toEqual({ saved: [], hidden: [], mutedSources: [], mutedParties: [] });
    for (const key of ["article-votes", "story-importa", "comment-likes", "ideas-voted", "idea-replies-voted", "stories-read"])
      expect(window.localStorage.getItem(key)).toBeNull();
    expect(currentExtras().follows.thread).toEqual([]);
  });
});

describe("logging in", () => {
  it("only goes back to pages on this site", () => {
    expect(safeReturn("/article/12")).toBe("/article/12");
    expect(safeReturn("//evil.example")).toBe("/");
    expect(safeReturn("/\\evil.example")).toBe("/");
    expect(safeReturn("https://evil.example")).toBe("/");
    expect(safeReturn(undefined)).toBe("/");
    // Browsers drop tabs and newlines in a URL and read a backslash as a slash: "/\t/evil" is "//evil".
    expect(safeReturn("/\t/evil.example")).toBe("/");
    expect(safeReturn("/\n/evil.example")).toBe("/");
    expect(safeReturn(" //evil.example")).toBe("/");
    expect(safeReturn("/x\\..\\/evil")).toBe("/");
    expect(safeReturn("/feedback?ordem=novas#topo")).toBe("/feedback?ordem=novas#topo");
  });

  it("rates passwords by length and mix, the obvious ones low", () => {
    expect(passwordStrength("curta")).toBe(0);
    expect(passwordStrength("politicando2026")).toBe(1);
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("abcdefg1")).toBe(2);
    expect(passwordStrength("Abcdefgh1234")).toBe(4);
  });
});

describe("the account's activity", () => {
  it("puts comments, threads and replies together, newest first, linked where the page is known", () => {
    const items = itemsOf({
      comments: [{ id: 1, body: "Olá", articleId: 5, storyId: null, postId: null, likes: 0, createdAt: "2026-11-10T10:00:00Z" }],
      threads: [{ id: 2, board: "ps", title: "Uma discussão", body: "…", createdAt: "2026-11-12T10:00:00Z" }],
      posts: [{ id: 3, threadId: 2, body: "Uma resposta", createdAt: "2026-11-11T10:00:00Z" }],
    });
    expect(items.map((item) => [item.kind, item.href])).toEqual([
      ["Discussão no fórum", "/forum/ps/2"],
      ["Resposta no fórum", null],
      ["Comentário", "/article/5#comentarios"],
    ]);
  });
});

describe("the account's email", () => {
  it("reads an older API's user as one with no email", () => {
    expect(userSchema.parse({ id: 1, username: "leitora", createdAt: "2026-11-10T10:00:00.000Z" })).toMatchObject({
      email: null,
      emailConfirmed: false,
      askForEmail: false,
      newsletter: null,
    });
  });

  it("reads the email, whether it's confirmed, the prompt and the newsletter", () => {
    const user = { id: 1, username: "leitora", createdAt: "x", email: "leitora@exemplo.pt", emailConfirmed: true, askForEmail: false };
    expect(userSchema.parse({ ...user, newsletter: "pending" })).toMatchObject({
      email: "leitora@exemplo.pt",
      emailConfirmed: true,
      newsletter: "pending",
    });
    expect(userSchema.parse({ ...user, newsletter: "weekly?" }).newsletter).toBeNull();
  });

  it("reads a sign-up's answer: the email sent, the newsletter pending", () => {
    const user = { id: 2, username: "novo", createdAt: "x" };
    expect(registerAnswerSchema.parse({ user })).toMatchObject({ emailSent: false, newsletter: null });
    expect(registerAnswerSchema.parse({ user, emailSent: true, newsletter: "pending" })).toMatchObject({
      emailSent: true,
      newsletter: "pending",
    });
  });

  it("checks an address before sending it, and only when there is one", () => {
    expect(emailProblem("")).toBeNull();
    expect(emailProblem("  ana@exemplo.pt ")).toBeNull();
    expect(emailProblem("ana@")).toMatch(/email/);
    expect(emailProblem("ana exemplo.pt")).toMatch(/email/);
  });

  it("words the email's errors", () => {
    expect(accountErrorMessage(new ApiError("x", 400, "invalid_email"))).toMatch(/email/);
    expect(accountErrorMessage(new ApiError("x", 400, "invalid_token"))).toMatch(/já não é válida/);
    expect(accountErrorMessage(new ApiError("x", 409, "email_taken"))).toMatch(/outra conta/);
    expect(accountErrorMessage(new ApiError("x", 503, "mail_unavailable"))).toMatch(/email/);
  });
});

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError, createComment, getArticle, getFeedPage } from "@/lib/api/client";
import { API, handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("api client", () => {
  it("paginates by cursor until nextCursor is null", async () => {
    const ids: number[] = [];
    let cursor: string | undefined;
    do {
      const page = await getFeedPage({ cursor });
      ids.push(...page.articles.map((article) => article.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(ids).toHaveLength(35);
    expect(new Set(ids).size).toBe(35);
  });

  it("keeps party feeds to that party", async () => {
    const { articles } = await getFeedPage({ party: "be" });
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((article) => article.parties.some((party) => party.slug === "be"))).toBe(true);
  });

  it("asks for several parties and papers as lists, and gets any of each", async () => {
    let asked = "";
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/articles?")) asked = new URL(request.url).search;
    });
    const { articles } = await getFeedPage({ party: ["be", "il"], source: ["publico.pt", "rtp.pt"] });
    server.events.removeAllListeners();
    expect(decodeURIComponent(asked)).toContain("party=be,il");
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((a) => a.parties.some((p) => ["be", "il"].includes(p.slug)) && ["Público", "RTP"].includes(a.source))).toBe(true);
  });

  it("while the API takes one value only, filters the rest itself and hands back the cursor to go on", async () => {
    server.use(
      http.get(`${API}/articles`, ({ request }) => {
        const search = new URL(request.url).searchParams;
        if ((search.get("party") ?? "").includes(","))
          return HttpResponse.json({ error: { code: "not_found", message: "Party not found" } }, { status: 404 });
        return undefined;
      }),
    );
    const seen: number[] = [];
    let cursor: string | undefined;
    do {
      const page = await getFeedPage({ party: ["be", "il"], cursor });
      expect(page.articles.every((a) => a.parties.some((p) => ["be", "il"].includes(p.slug)))).toBe(true);
      seen.push(...page.articles.map((a) => a.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen.length).toBeGreaterThan(5);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("reports status and error code", async () => {
    await expect(getArticle(99999)).rejects.toMatchObject({ name: "ApiError", status: 404, code: "not_found" });
  });

  it("fails visibly on an unexpected response shape", async () => {
    server.use(http.get(`${API}/articles`, () => HttpResponse.json({ items: [{ nope: true }], nextCursor: null })));
    await expect(getFeedPage()).rejects.toBeInstanceOf(ApiError);
  });

  it("sends only documented fields to the article's comment route", async () => {
    let url = "";
    let body: unknown;
    server.use(
      http.post(`${API}/articles/:id/comments`, async ({ request }) => {
        url = request.url;
        body = await request.json();
        return HttpResponse.json(
          { id: 5, articleId: 100, parentId: 1, username: null, parentUsername: null, body: "olá", createdAt: "2026-10-30T12:00:00.000Z" },
          { status: 201 },
        );
      }),
    );
    const created = await createComment({ articleId: 100, parentId: 1, username: "", text: "olá", captchaToken: "tok" });
    expect(url).toMatch(/\/articles\/100\/comments$/);
    expect(created).toMatchObject({ id: 5, parentId: 1, text: "olá" });
    expect(body).toEqual({ body: "olá", parentId: 1, recaptchaToken: "tok" });
  });

  it("leaves parentId out of a top-level comment, which the real API's strict schema allows", async () => {
    const created = await createComment({ articleId: 100, parentId: null, username: "ana", text: "olá", captchaToken: "tok" });
    expect(created).toMatchObject({ parentId: null, username: "ana" });
  });
});

describe("party data the API gets wrong", () => {
  it("shows (A)TUA's acronym in full wherever a party appears", async () => {
    server.use(
      http.get(`${API}/parties`, () =>
        HttpResponse.json([
          { slug: "atua", acronym: "A)T", name: "(A)TUA", website: null },
          { slug: "ps", acronym: "PS", name: "Partido Socialista", website: null },
        ]),
      ),
    );
    const { getParties } = await import("@/lib/api/client");
    expect((await getParties()).map((party) => party.acronym)).toEqual(["(A)TUA", "PS"]);
  });
});

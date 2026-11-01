import { http, HttpResponse } from "msw";
import { z } from "zod";
import { articles, comments as seedComments, parties } from "./fixtures";

export const API = "*/api/v2";
const EXCERPT_LENGTH = 300;
const store = new Map(Object.entries(seedComments).map(([id, list]) => [Number(id), [...list]]));
let nextCommentId = 1000;

const fail = (status: number, code: string) => HttpResponse.json({ error: { code, message: code } }, { status });

// Mirrors the real API, which rejects unknown fields.
const newCommentSchema = z.strictObject({
  username: z.string().trim().max(50).nullish(),
  body: z.string().trim().min(1).max(500),
  parentId: z.number().int().positive().nullish(),
  recaptchaToken: z.string().min(1),
});

export const handlers = [
  http.get(`${API}/parties`, () => HttpResponse.json(parties)),
  http.get(`${API}/articles`, ({ request }) => {
    const search = new URL(request.url).searchParams;
    const party = search.get("party");
    const cursor = search.get("cursor");
    const limit = Number(search.get("limit") ?? 10);
    if (party && !parties.some((item) => item.slug === party)) return fail(404, "not_found");
    if (cursor && !/^c\d+$/.test(cursor)) return fail(400, "invalid_cursor");

    const matching = articles
      .filter((article) => !party || article.parties.some((item) => item.slug === party))
      .filter((article) => !cursor || article.id < Number(cursor.slice(1)));
    const page = matching.slice(0, limit);
    return HttpResponse.json({
      items: page.map(({ content, ...article }) => ({ ...article, excerpt: content.slice(0, EXCERPT_LENGTH) })),
      nextCursor: matching.length > limit ? `c${page.at(-1)!.id}` : null,
    });
  }),
  http.get(`${API}/articles/:id/comments`, ({ params }) => HttpResponse.json(store.get(Number(params.id)) ?? [])),
  http.get(`${API}/articles/:id`, ({ params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return fail(400, "invalid_request");
    const article = articles.find((item) => item.id === id);
    return article ? HttpResponse.json(article) : fail(404, "not_found");
  }),
  http.post(`${API}/articles/:id/comments`, async ({ params, request }) => {
    const parsed = newCommentSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    const { username, body, parentId } = parsed.data;
    // Comments containing these words simulate API failures in tests.
    if (body.includes("ERRO-SERVIDOR")) return fail(500, "internal_error");
    if (body.includes("ERRO-LIMITE")) return fail(429, "rate_limited");

    const articleId = Number(params.id);
    const created = {
      id: nextCommentId++,
      articleId,
      parentId: parentId ?? null,
      username: username || null,
      parentUsername: null,
      body,
      createdAt: new Date().toISOString(),
    };
    store.set(articleId, [...(store.get(articleId) ?? []), created]);
    return HttpResponse.json(created, { status: 201 });
  }),
];

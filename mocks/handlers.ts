import { http, HttpResponse } from "msw";
import { z } from "zod";
import { articles, comments as seedComments, parties } from "./fixtures";
import { electionResult, elections } from "./electionFixtures";
import { government, governmentMember } from "./governmentFixtures";
import { governmentHistory, timeline } from "./historyFixtures";
import { editorialPosts } from "./editorialFixtures";
import { contractHandlers } from "./contractFixtures";
import { placeHandlers } from "./placeFixtures";
import { forumHandlers } from "./forumFixtures";
import { presidencyHandlers } from "./presidencyFixtures";
import { deputies, deputyDetail, deputyVotes, initiativeDetails, initiatives, parliament } from "./parliamentFixtures";

export const API = "*/api/v2";
const store = new Map(Object.entries(seedComments).map(([id, list]) => [Number(id), [...list]]));
let nextCommentId = 1000;

/** A few articles "mention" each deputy, so the deputy card has news to show. */
const mentions = (articleId: number, deputyId: number) => (articleId + deputyId) % 9 === 0;

const fail = (status: number, code: string) => HttpResponse.json({ error: { code, message: code } }, { status });

// Mirrors the real API, which rejects unknown fields.
const newCommentSchema = z.strictObject({
  username: z.string().trim().max(50).nullish(),
  body: z.string().trim().min(1).max(500),
  parentId: z.number().int().positive().nullish(),
  recaptchaToken: z.string().min(1),
});

const answer = (result: ReturnType<typeof electionResult>) =>
  result.status === 200 ? HttpResponse.json(result.body) : fail(result.status, result.code);

export const handlers = [
  http.get(`${API}/editorial`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const featured = params.get("featured");
    const kind = params.get("kind");
    const limit = Number(params.get("limit") ?? 10);
    const page = Number(params.get("page") ?? 1);
    const matching = editorialPosts.filter(
      (post) => (featured === null || String(post.featured) === featured) && (!kind || post.kind === kind),
    );
    const items = matching.slice((page - 1) * limit, page * limit).map((post) => ({ ...post, body: undefined })); // The list has no body.;
    return HttpResponse.json({ items, total: matching.length });
  }),
  http.get(`${API}/editorial/:slug`, ({ params }) => {
    const post = editorialPosts.find((item) => item.slug === params.slug);
    return post ? HttpResponse.json(post) : fail(404, "not_found");
  }),
  http.get(`${API}/governments/history`, () => HttpResponse.json(governmentHistory)),
  http.get(`${API}/timeline`, ({ request }) => {
    const kinds = new URL(request.url).searchParams.get("kinds")?.split(",");
    return HttpResponse.json({ items: timeline.items.filter((item) => !kinds || kinds.includes(item.kind)) });
  }),
  http.get(`${API}/elections`, ({ request }) => {
    const type = new URL(request.url).searchParams.get("type");
    return HttpResponse.json({ items: elections.items.filter((item) => !type || item.type === type) });
  }),
  http.get(`${API}/elections/:id/places/:key`, ({ params, request }) =>
    answer(electionResult(String(params.id), String(params.key), new URL(request.url).searchParams.get("organ"))),
  ),
  http.get(`${API}/elections/:id`, ({ params, request }) =>
    answer(electionResult(String(params.id), null, new URL(request.url).searchParams.get("organ"))),
  ),
  http.get(`${API}/parties`, () => HttpResponse.json(parties)),
  http.get(`${API}/articles`, ({ request }) => {
    const search = new URL(request.url).searchParams;
    const party = search.get("party");
    const deputy = search.get("deputy");
    const cursor = search.get("cursor");
    const limit = Number(search.get("limit") ?? 10);
    if (party && !parties.some((item) => item.slug === party)) return fail(404, "not_found");
    if (cursor && !/^c\d+$/.test(cursor)) return fail(400, "invalid_cursor");

    if (deputy && !deputies.some((item) => item.id === Number(deputy))) return fail(404, "not_found");

    const matching = articles
      .filter((article) => !party || article.parties.some((item) => item.slug === party))
      .filter((article) => !deputy || mentions(article.id, Number(deputy)))
      .filter((article) => !cursor || article.id < Number(cursor.slice(1)));
    const page = matching.slice(0, limit);
    return HttpResponse.json({
      items: page,
      nextCursor: matching.length > limit ? `c${page.at(-1)!.id}` : null,
    });
  }),
  http.get(`${API}/parliament`, () => HttpResponse.json(parliament)),
  http.get(`${API}/deputies/:id/votes`, ({ params, request }) => {
    const result = deputyVotes(Number(params.id));
    if (!result) return fail(404, "not_found");
    const search = new URL(request.url).searchParams;
    const cursor = search.get("cursor");
    const limit = Number(search.get("limit") ?? 20);
    if (cursor && !/^v\d+$/.test(cursor)) return fail(400, "invalid_cursor");
    const start = cursor ? Number(cursor.slice(1)) : 0;
    const items = result.items.slice(start, start + limit);
    return HttpResponse.json({
      summary: result.summary,
      items,
      nextCursor: start + limit < result.items.length ? `v${start + limit}` : null,
    });
  }),
  http.get(`${API}/government`, () => HttpResponse.json(government)),
  http.get(`${API}/government/members/:id`, ({ params }) => {
    const memberId = String(params.id);
    if (!/^[0-9a-f]{32}$/.test(memberId)) return fail(400, "invalid_request");
    const detail = governmentMember(
      memberId,
      articles.filter((article) => article.id % 13 === Number.parseInt(memberId, 16) % 13).slice(0, 10),
    );
    return detail ? HttpResponse.json(detail) : fail(404, "not_found");
  }),
  http.get(`${API}/deputies/:id`, ({ params }) => {
    const id = Number(params.id);
    const detail = deputyDetail(id, articles.filter((article) => mentions(article.id, id)).slice(0, 10));
    return detail ? HttpResponse.json(detail) : fail(404, "not_found");
  }),
  http.get(`${API}/initiatives/:id`, ({ params }) => {
    if (params.id === "topics") return; // Answered by the presidency handlers.
    const detail = initiativeDetails.find((item) => item.id === Number(params.id));
    if (!detail) return fail(404, "not_found");
    const related = detail.coverage?.articles ? articles.slice(detail.id % 20, (detail.id % 20) + 3) : [];
    return HttpResponse.json({ ...detail, legislature: "XVII", articles: related });
  }),
  http.get(`${API}/initiatives`, ({ request }) => {
    const search = new URL(request.url).searchParams;
    const status = search.get("status");
    const deputy = search.get("deputy");
    const party = search.get("party");
    const presidency = search.get("presidency");
    const topic = search.get("topic");
    const cursor = search.get("cursor");
    const limit = Number(search.get("limit") ?? 10);
    if (cursor && !/^i\d+$/.test(cursor)) return fail(400, "invalid_cursor");

    const matching = initiatives
      .filter((item) => !status || item.status === status)
      .filter((item) => !deputy || item.authors.deputies?.some((author) => author.id === Number(deputy)))
      .filter((item) => !party || item.authors.parties?.some((author) => author.slug === party))
      .filter((item) => !presidency || item.presidency?.status === presidency)
      .filter((item) => !topic || item.topics?.some((tag) => tag.slug === topic))
      .filter((item) => !cursor || item.id < Number(cursor.slice(1)));
    const page = matching.slice(0, limit);
    return HttpResponse.json({ items: page, nextCursor: matching.length > limit ? `i${page.at(-1)!.id}` : null });
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
  ...contractHandlers,
  ...placeHandlers,
  ...forumHandlers,
  ...presidencyHandlers,
];

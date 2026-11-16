import { http, HttpResponse } from "msw";
import { z } from "zod";
import { articles, comments as seedComments, parties } from "./fixtures";
import { electionResult, elections, partiesWithResults } from "./electionFixtures";
import { government, governmentMember } from "./governmentFixtures";
import { governmentHistory, timeline } from "./historyFixtures";
import { becomeDeputyHandlers } from "./becomeDeputyFixtures";
import { editorialPosts } from "./editorialFixtures";
import { contractHandlers } from "./contractFixtures";
import { placeHandlers } from "./placeFixtures";
import { forumHandlers } from "./forumFixtures";
import { presidencyHandlers } from "./presidencyFixtures";
import { peopleHandlers } from "./peopleFixtures";
import { sitemapHandlers } from "./sitemapFixtures";
import { partyVoteHandlers } from "./partyVoteFixtures";
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

/** Leaders, as the real API curates them: one in the Government, one a deputy, one with no page of ours. */
const psLeader = deputies.find((deputy) => deputy.party === "ps")!;
const leaders: Record<string, { name: string; title: string; deputyId: number | null; governmentMemberId: string | null }> = {
  psd: {
    name: government.primeMinister!.name!,
    title: "Presidente do PSD",
    deputyId: null,
    governmentMemberId: government.primeMinister!.id!,
  },
  ps: { name: psLeader.name, title: "Secretário-geral do PS", deputyId: psLeader.id, governmentMemberId: null },
  be: { name: "Marta Quintela", title: "Coordenadora do Bloco de Esquerda", deputyId: null, governmentMemberId: null },
};

const answer = (result: ReturnType<typeof electionResult>) =>
  result.status === 200 ? HttpResponse.json(result.body) : fail(result.status, result.code);

/** The API's phases, as /initiatives sends them in `stages`. */
const STAGE_KEYS = [
  ["submitted", "Entregue", "Deu entrada no Parlamento e ainda não foi debatida."],
  ["debate", "Em debate", "Em discussão: numa comissão, em consulta ou à espera de votação."],
  ["approved", "Aprovada", "Aprovada pelo Parlamento, ainda não seguiu para o Presidente ou espera publicação."],
  ["president", "No Presidente", "Enviada ao Presidente da República, que tem de promulgar ou vetar."],
  ["vetoed", "Vetada", "O Presidente vetou e devolveu-a ao Parlamento, que pode alterá-la ou confirmá-la."],
  ["published", "Lei", "Publicada em Diário da República: é lei, ou resolução, em vigor."],
  ["rejected", "Rejeitada", "Chumbada numa votação, ou não admitida."],
  ["withdrawn", "Retirada", "Os autores retiraram-na."],
] as const;

/** Which of those phases an initiative is in, from its plain status. */
function stageOf(item: (typeof initiatives)[number]): string {
  const stage = item.plain?.status.stage;
  if (stage === "committee" || stage === "consultation" || stage === "approved_in_principle") return "debate";
  if (stage === "awaiting_president") return "president";
  if (stage === "promulgated") return "published";
  if (stage === "not_admitted") return "rejected";
  return stage ?? "submitted";
}

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
    return HttpResponse.json({ items: elections.items.filter((item) => !type || item.type === type), upcoming: elections.upcoming });
  }),
  http.get(`${API}/elections/:id/places/:key`, ({ params, request }) =>
    answer(electionResult(String(params.id), String(params.key), new URL(request.url).searchParams.get("organ"))),
  ),
  http.get(`${API}/elections/:id`, ({ params, request }) =>
    answer(electionResult(String(params.id), null, new URL(request.url).searchParams.get("organ"))),
  ),
  http.get(`${API}/parties`, ({ request }) =>
    HttpResponse.json(
      partiesWithResults(
        parties,
        new Map(parliament.groups.map((group) => [group.party.slug, group.seats])),
        new URL(request.url).searchParams.get("sort"),
      ).map((party) => ({ ...party, leader: leaders[party.slug] ?? null })),
    ),
  ),
  http.get(`${API}/articles/sources`, () => {
    const counts = new Map<string, number>();
    for (const article of articles) counts.set(article.source, (counts.get(article.source) ?? 0) + 1);
    return HttpResponse.json({ items: [...counts].map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count) });
  }),
  http.post(`${API}/newsletter/subscribe`, async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { email?: unknown; recaptchaToken?: unknown } | null;
    if (!body?.recaptchaToken) return fail(400, "invalid_request");
    if (typeof body.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return fail(400, "invalid_email");
    return HttpResponse.json({ status: "pending" }, { status: 202 });
  }),
  // Mainland Portugal's box: anywhere inside is Águeda, the fixtures' first municipality.
  http.get(`${API}/places/locate`, ({ request }) => {
    const search = new URL(request.url).searchParams;
    const lat = Number(search.get("lat"));
    const lon = Number(search.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || search.get("lat") === null) return fail(400, "invalid_request");
    if (lat < 36.9 || lat > 42.2 || lon < -9.6 || lon > -6.1) return fail(404, "not_found");
    return HttpResponse.json({ key: "LOCAL-010100", name: "Águeda", level: "municipality", parentKey: "LOCAL-010000", dicofre: "0101" });
  }),
  http.get(`${API}/articles`, ({ request }) => {
    const search = new URL(request.url).searchParams;
    const words = (search.get("q") ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/\s+/).filter(Boolean);
    // Lists, as asked of the backend: "party=ps,psd&source=publico.pt,expresso.pt" match any of each.
    const sources = (search.get("source") ?? "").split(",").filter(Boolean);
    const byComments = search.get("sort") === "comments";
    const folded = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const partyList = (search.get("party") ?? "").split(",").filter(Boolean);
    const deputy = search.get("deputy");
    const cursor = search.get("cursor");
    const limit = Number(search.get("limit") ?? 10);
    if (partyList.some((slug) => !parties.some((item) => item.slug === slug))) return fail(404, "not_found");
    if (cursor && !/^c\d+$/.test(cursor)) return fail(400, "invalid_cursor");

    if (deputy && !deputies.some((item) => item.id === Number(deputy))) return fail(404, "not_found");

    const matching = articles
      .filter((article) => partyList.length === 0 || article.parties.some((item) => partyList.includes(item.slug)))
      .filter((article) => !deputy || mentions(article.id, Number(deputy)))
      .filter((article) => words.every((word) => folded(`${article.title} ${article.excerpt}`).includes(word)))
      .filter((article) => sources.length === 0 || sources.includes(article.source))
      .filter((article) => !byComments || article.commentCount > 0)
      .filter((article) => !cursor || article.id < Number(cursor.slice(1)));
    if (byComments) matching.sort((x, y) => y.commentCount - x.commentCount);
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
    const stage = search.get("stage");
    const q = search.get("q")?.toLowerCase().trim();
    const oldest = search.get("sort") === "oldest";
    const cursor = search.get("cursor");
    const limit = Number(search.get("limit") ?? 10);
    if (cursor && !/^i\d+$/.test(cursor)) return fail(400, "invalid_cursor");

    const matching = initiatives
      .filter((item) => !status || item.status === status)
      .filter((item) => !deputy || item.authors.deputies?.some((author) => author.id === Number(deputy)))
      .filter((item) => !party || item.authors.parties?.some((author) => author.slug === party))
      .filter((item) => !presidency || item.presidency?.status === presidency)
      .filter((item) => !topic || item.topics?.some((tag) => tag.slug === topic))
      .filter((item) => !q || `${item.title} ${item.plain?.title ?? ""} ${item.number ?? ""}`.toLowerCase().includes(q));
    // Each phase counted with every filter but the phase, as the API does.
    const stages = STAGE_KEYS.map(([key, label, plain]) => ({
      key,
      label,
      plain,
      count: matching.filter((item) => stageOf(item) === key).length,
    }));
    const inStage = matching.filter((item) => !stage || stageOf(item) === stage);
    const ordered = oldest ? [...inStage].reverse() : inStage;
    const after = ordered.filter((item) => !cursor || (oldest ? item.id > Number(cursor.slice(1)) : item.id < Number(cursor.slice(1))));
    const page = after.slice(0, limit);
    // `total` counts every match, not just what is left after the cursor.
    return HttpResponse.json({
      items: page,
      nextCursor: after.length > limit ? `i${page.at(-1)!.id}` : null,
      total: inStage.length,
      stages,
    });
  }),
  http.get(`${API}/articles/:id/comments`, ({ params }) => HttpResponse.json(store.get(Number(params.id)) ?? [])),
  http.get(`${API}/articles/:id`, ({ params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return fail(400, "invalid_request");
    const article = articles.find((item) => item.id === id);
    if (!article) return fail(404, "not_found");
    // Article 100 mentions an initiative, for the context box beside it.
    const mentioned = id === 100 && initiatives[0] ? [{ id: initiatives[0].id, title: initiatives[0].title }] : [];
    return HttpResponse.json({ ...article, initiatives: mentioned });
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
  ...peopleHandlers,
  ...becomeDeputyHandlers,
  ...sitemapHandlers,
  ...partyVoteHandlers,
];

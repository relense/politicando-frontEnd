import { http, HttpResponse } from "msw";
import { z } from "zod";
import { looksLikeTeam } from "../lib/reservedNames";
import { articles, comments as seedComments, parties } from "./fixtures";
import { electionResult, elections, partiesWithResults } from "./electionFixtures";
import { government, governmentMember } from "./governmentFixtures";
import { governmentHistory, timeline } from "./historyFixtures";
import { becomeDeputyHandlers } from "./becomeDeputyFixtures";
import { editorialAdminHandlers, publicPosts } from "./editorialAdmin";
import { contractHandlers } from "./contractFixtures";
import { placeHandlers } from "./placeFixtures";
import { legislatureHandlers } from "./legislatureFixtures";
import { agendaHandlers } from "./agendaFixtures";
import { feedbackHandlers } from "./feedbackFixtures";
import { forumHandlers, forumTarget, hideForum } from "./forumFixtures";
import { storyHandlers } from "./storyFixtures";
import { accountHandlers, gateRefusal, readerOf, recordVote } from "./accountFixtures";
import { engagementHandlers, registerCommentLookup } from "./engagementFixtures";
import { adminHandlers } from "./adminFixtures";
import { audit, hiddenComments, reportsStore, requireAdmin } from "./adminState";
import { presidencyHandlers } from "./presidencyFixtures";
import { peopleHandlers } from "./peopleFixtures";
import { sitemapHandlers } from "./sitemapFixtures";
import { partyVoteHandlers } from "./partyVoteFixtures";
import { deputies, deputyDetail, deputyVotes, initiativeDetails, initiatives, parliament } from "./parliamentFixtures";

export const API = "*/api/v2";
const store = new Map(Object.entries(seedComments).map(([id, list]) => [Number(id), [...list]]));
registerCommentLookup((id) => {
  for (const [articleId, list] of store) {
    const comment = list.find((item) => item.id === id);
    if (comment) return { id, body: comment.body, username: comment.username ?? null, createdAt: comment.createdAt, articleId };
  }
  return null;
});
let nextCommentId = 1000;
const postCommentStore = new Map<
  string,
  {
    id: number;
    postId: number;
    parentId: number | null;
    username: string | null;
    parentUsername: string | null;
    body: string;
    createdAt: string;
  }[]
>([
  [
    "o-que-muda-no-orcamento",
    [
      {
        id: 700,
        postId: 0,
        parentId: null,
        username: "leitora",
        parentUsername: null,
        body: "Bem explicado, obrigado.",
        createdAt: "2026-11-15T10:00:00.000Z",
      },
    ],
  ],
]);

/** A few articles "mention" each deputy, so the deputy card has news to show. */
const mentions = (articleId: number, deputyId: number) => (articleId + deputyId) % 9 === 0;

const fail = (status: number, code: string) => HttpResponse.json({ error: { code, message: code } }, { status });

// Mirrors the real API, which rejects unknown fields.
const newCommentSchema = z.strictObject({
  username: z.string().trim().max(50).nullish(),
  body: z.string().trim().min(1).max(500),
  parentId: z.number().int().positive().nullish(),
  // Accounts need none (accounts-api.md).
  recaptchaToken: z.string().min(1).optional(),
});

/** As the API: a name that passes for the team is a plain validation error (docs/forums-api.md). */
const teamName = (field: string, name: string | null | undefined) =>
  name && looksLikeTeam(name)
    ? HttpResponse.json({ error: { code: "invalid_request", message: `body/${field} That name is the team's` } }, { status: 400 })
    : null;

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

/** Reads per post since the mock API started; one post starts with some, so the count shows without reading it. */
const postViews = new Map<string, number>([["o-que-muda-no-orcamento", 1284]]);

/** The mock's one reader's votes on articles. */
const myVotes = new Map<number, number>();
/** "Importa" on our posts (editorial-api.md "Importa"): totals by slug, and this mock reader's own mark. */
const postImporta = new Map<string, number>([["a-maioria-que-nao-existe", 11]]);
const myPostMarks = new Set<string>();
/** What every post in the list carries: visible comments and Importa (and the old up/down, as the API still sends). */
const postCounts = (slug: string) => ({
  commentCount: (postCommentStore.get(slug) ?? []).length,
  importa: postImporta.get(slug) ?? 0,
  upvotes: postImporta.get(slug) ?? 0,
  downvotes: 0,
});

export const handlers = [
  // Our podcast's newest episode (backend docs/podcast-api.md), fictional.
  http.get(`${API}/podcast/latest`, () =>
    HttpResponse.json({
      title: "18 nov. · O Orçamento na reta final, explicado",
      publishedAt: "2026-11-18T11:28:00.000Z",
      durationSeconds: 1460,
      episodeNumber: null,
      imageUrl: null,
      spotifyUrl: "https://open.spotify.com/episode/0000000000TesteEpis03",
    }),
  ),
  http.get(`${API}/editorial`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const featured = params.get("featured");
    const kind = params.get("kind");
    const limit = Number(params.get("limit") ?? 10);
    const page = Number(params.get("page") ?? 1);
    const matching = publicPosts().filter(
      (post) => (featured === null || String(post.featured) === featured) && (!kind || post.kind === kind),
    );
    // The list has no body.
    const items = matching.slice((page - 1) * limit, page * limit).map((post) => ({ ...post, body: undefined, ...postCounts(post.slug) }));
    return HttpResponse.json({ items, total: matching.length });
  }),
  http.get(`${API}/editorial/:slug`, ({ params }) => {
    const post = publicPosts().find((item) => item.slug === params.slug);
    // `views`: all the post's reads so far (asked of the backend; the page shows it only when it comes).
    return post ? HttpResponse.json({ ...post, views: postViews.get(post.slug) ?? 0, ...postCounts(post.slug) }) : fail(404, "not_found");
  }),
  // A read, sent by the browser (editorial-api.md "Most read"): no body, 204.
  http.post(`${API}/editorial/:slug/view`, ({ params }) => {
    const slug = String(params.slug);
    if (!publicPosts().some((item) => item.slug === slug)) return fail(404, "not_found");
    postViews.set(slug, (postViews.get(slug) ?? 0) + 1);
    return new HttpResponse(null, { status: 204 });
  }),
  // A vote on a post, as on news: `{ value: 1 | -1 | 0 }`, answering the new totals.
  http.post(`${API}/editorial/:slug/vote`, async ({ params, request }) => {
    const refused = gateRefusal(request);
    if (refused) return refused;
    const slug = String(params.slug);
    if (!publicPosts().some((item) => item.slug === slug)) return fail(404, "not_found");
    const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
    const value = body?.value;
    if (value !== 1 && value !== -1 && value !== 0) return fail(400, "invalid_request");
    // -1 is still accepted for the old buttons: it takes the mark back.
    const mark = value === 1;
    const importa = (postImporta.get(slug) ?? 0) - (myPostMarks.has(slug) ? 1 : 0) + (mark ? 1 : 0);
    postImporta.set(slug, importa);
    if (mark) myPostMarks.add(slug);
    else myPostMarks.delete(slug);
    recordVote(request, "editorial", slug, mark ? 1 : 0);
    return HttpResponse.json({ importa, mine: mark ? 1 : 0, up: importa, down: 0 });
  }),
  // Comments on our posts: the same as on news, by slug (editorial-api.md "Comments").
  http.get(`${API}/editorial/:slug/comments`, ({ params }) => {
    if (!publicPosts().some((item) => item.slug === params.slug)) return fail(404, "not_found");
    return HttpResponse.json(postCommentStore.get(String(params.slug)) ?? []);
  }),
  http.post(`${API}/editorial/:slug/comments`, async ({ params, request }) => {
    const post = publicPosts().find((item) => item.slug === params.slug);
    if (!post) return fail(404, "not_found");
    const parsed = newCommentSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    const reserved = teamName("username", parsed.data.username);
    if (reserved) return reserved;
    const { username, body, parentId } = parsed.data;
    const slug = String(params.slug);
    const created = {
      id: nextCommentId++,
      postId: post.id,
      parentId: parentId ?? null,
      username: username || null,
      parentUsername: null,
      body,
      createdAt: new Date().toISOString(),
    };
    postCommentStore.set(slug, [...(postCommentStore.get(slug) ?? []), created]);
    return HttpResponse.json(created, { status: 201 });
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
  // The buttons on the pages the emails link to (newsletter-api.md). Tokens containing "expirado" are no longer valid.
  ...(["confirm", "unsubscribe"] as const).map((action) =>
    http.post(`${API}/newsletter/${action}`, async ({ request }) => {
      const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
      if (typeof body?.token !== "string" || !body.token || body.token.includes("expirado")) return fail(400, "invalid_token");
      return HttpResponse.json({ status: action === "confirm" ? "confirmed" : "unsubscribed" });
    }),
  ),
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
    // The reader's saved articles (articles-api.md "The article menu"): these ids, newest first.
    const ids = search.get("ids");
    if (ids !== null) {
      const wanted = ids.split(",").map(Number);
      if (wanted.length > 100 || wanted.some((id) => !Number.isInteger(id) || id <= 0)) return fail(400, "invalid_request");
      return HttpResponse.json({ items: articles.filter((item) => wanted.includes(item.id)), nextCursor: null, total: null });
    }
    const words = (search.get("q") ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/\s+/).filter(Boolean);
    // Lists, as asked of the backend: "party=ps,psd&source=publico.pt,expresso.pt" match any of each.
    const sources = (search.get("source") ?? "").split(",").filter(Boolean);
    const sort = search.get("sort");
    const byComments = sort === "comments";
    const period = search.get("period");
    if (sort && !["newest", "comments", "top", "controversial", "views", "trending"].includes(sort)) return fail(400, "invalid_request");
    const days = search.get("days");
    if (days !== null && !(/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 90)) return fail(400, "invalid_request");
    if (period && !["today", "yesterday", "week", "month"].includes(period)) return fail(400, "invalid_request");
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
    // The fixtures are all from one day, so the period filters nothing here.
    const up = (article: (typeof articles)[number]) => article.upvotes ?? 0;
    const down = (article: (typeof articles)[number]) => article.downvotes ?? 0;
    // "Mais lidas": by reads (all reads stand in for the last days here); "Em alta": votes, comments and reads together.
    if (sort === "views") matching.sort((x, y) => (y.views ?? 0) - (x.views ?? 0) || y.id - x.id);
    if (sort === "trending") {
      const points = (item: (typeof matching)[number]) =>
        up(item) - down(item) + 2 * item.commentCount + Math.floor((item.views ?? 0) / 10);
      matching.sort((x, y) => points(y) - points(x) || y.id - x.id);
    }
    if (sort === "top") matching.sort((x, y) => up(y) - down(y) - (up(x) - down(x)) || y.id - x.id);
    if (sort === "controversial") {
      const divided = (article: (typeof articles)[number]) =>
        up(article) && down(article)
          ? (up(article) + down(article)) ** (Math.min(up(article), down(article)) / Math.max(up(article), down(article)))
          : -1;
      matching.sort((x, y) => divided(y) - divided(x) || y.id - x.id);
      matching.splice(0, matching.length, ...matching.filter((article) => divided(article) >= 0));
    }
    const page = matching.slice(0, limit);
    return HttpResponse.json({
      items: page,
      nextCursor: matching.length > limit ? `c${page.at(-1)!.id}` : null,
      // Counted before the cursor, so it is the same on every page.
      total: articles
        .filter((article) => partyList.length === 0 || article.parties.some((item) => partyList.includes(item.slug)))
        .filter((article) => !deputy || mentions(article.id, Number(deputy)))
        .filter((article) => words.every((word) => folded(`${article.title} ${article.excerpt}`).includes(word)))
        .filter((article) => sources.length === 0 || sources.includes(article.source))
        .filter((article) => !byComments || article.commentCount > 0).length,
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
      // Half of those with news carry their latest headlines (the proposed coverage.latest); the rest load them when opened.
      items: page.map((item) =>
        item.coverage?.articles && item.id % 10 === 0
          ? {
              ...item,
              coverage: {
                ...item.coverage,
                latest: articles
                  .slice(item.id % 20, (item.id % 20) + 3)
                  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
                  .map((article) => ({
                    id: article.id,
                    title: article.title,
                    source: article.source,
                    publishedAt: article.publishedAt,
                  })),
              },
            }
          : item,
      ),
      nextCursor: after.length > limit ? `i${page.at(-1)!.id}` : null,
      total: inStage.length,
      stages,
    });
  }),
  http.get(`${API}/articles/:id/comments`, ({ params }) =>
    HttpResponse.json((store.get(Number(params.id)) ?? []).filter((comment) => !hiddenComments.has(comment.id))),
  ),

  // Moderation of comments (admin-api.md).
  http.get(`${API}/admin/comments`, ({ request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const query = new URL(request.url).searchParams;
    const status = query.get("status") ?? "visible";
    const before = Number(query.get("before") ?? Infinity);
    const limit = Number(query.get("limit") ?? 50);
    const all = [...store.entries()]
      .flatMap(([articleId, list]) =>
        list.map((comment) => ({
          id: comment.id,
          articleId,
          articleTitle: articles.find((article) => article.id === articleId)?.title ?? null,
          parentId: comment.parentId ?? null,
          username: comment.username ?? null,
          body: comment.body,
          createdAt: comment.createdAt,
          hiddenAt: hiddenComments.get(comment.id) ?? null,
        })),
      )
      .filter((comment) => comment.id < before && (status === "all" || (status === "hidden") === Boolean(comment.hiddenAt)))
      .sort((a, b) => b.id - a.id);
    return HttpResponse.json({ items: all.slice(0, limit) });
  }),
  http.post(`${API}/admin/comments/:id/:action`, ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const id = Number(params.id);
    if (![...store.values()].some((list) => list.some((comment) => comment.id === id))) return fail(404, "not_found");
    if (params.action === "hide") hiddenComments.set(id, new Date().toISOString());
    else if (params.action === "unhide") hiddenComments.delete(id);
    else return fail(404, "not_found");
    audit(admin, `comment.${String(params.action)}`, "comment", id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Reports queue (admin-api.md): comments here, threads and posts through the forum fixtures.
  http.get(`${API}/admin/reports`, ({ request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const resolved = new URL(request.url).searchParams.get("status") === "resolved";
    const commentTarget = (id: number) => {
      for (const [articleId, list] of store) {
        const comment = list.find((item) => item.id === id);
        if (comment) return { text: comment.body, hidden: hiddenComments.has(id), threadId: null, articleId };
      }
      return null;
    };
    const articleTarget = (id: number) => {
      const article = articles.find((item) => item.id === id);
      return article ? { text: `${article.title}\n\n${article.url}`, hidden: false, threadId: null, articleId: id } : null;
    };
    const items = reportsStore
      .filter((report) => (report.resolution !== null) === resolved)
      .sort((a, b) => b.reports - a.reports)
      .map((report) => ({
        ...report,
        target:
          report.kind === "comment"
            ? commentTarget(report.targetId)
            : report.kind === "article"
              ? articleTarget(report.targetId)
              : forumTarget(report.kind, report.targetId),
      }));
    return HttpResponse.json({ items });
  }),
  http.post(`${API}/admin/reports/resolve`, async ({ request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const body = (await request.json()) as {
      kind: "thread" | "post" | "comment" | "article";
      targetId: number;
      action: "hide" | "dismiss";
    };
    const open = reportsStore.filter((report) => report.kind === body.kind && report.targetId === body.targetId && !report.resolution);
    for (const report of open) report.resolution = body.action;
    if (body.action === "hide") {
      if (body.kind === "comment") hiddenComments.set(body.targetId, new Date().toISOString());
      else if (body.kind !== "article") hideForum(body.kind, body.targetId);
    }
    audit(admin, `report.${body.action}`, body.kind, body.targetId);
    return HttpResponse.json({ resolved: open.reduce((sum, report) => sum + report.reports, 0) });
  }),
  http.get(`${API}/articles/:id`, ({ params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return fail(400, "invalid_request");
    const article = articles.find((item) => item.id === id);
    if (!article) return fail(404, "not_found");
    // Article 100 mentions an initiative, for the context box beside it.
    const mentioned = id === 100 && initiatives[0] ? [{ id: initiatives[0].id, title: initiatives[0].title }] : [];
    // It also names a deputy and a mayor who have pages here, to link their names.
    const named = deputies.find((deputy) => mentions(id, deputy.id));
    const people =
      id === 100
        ? [
            ...(named ? [{ kind: "deputy" as const, id: String(named.id), name: named.name }] : []),
            { kind: "local" as const, id: "marta-quintela", name: "Marta Quintela" },
          ]
        : [];
    return HttpResponse.json({ ...article, initiatives: mentioned, people });
  }),
  // A vote (articles-api.md "Votes"): one per reader, replaced by the next, 0 takes it back. The mock has one reader.
  http.post(`${API}/articles/:id/vote`, async ({ params, request }) => {
    const refused = gateRefusal(request);
    if (refused) return refused;
    const article = articles.find((item) => item.id === Number(params.id));
    if (!article) return fail(404, "not_found");
    const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
    const value = body?.value;
    if (value !== 1 && value !== -1 && value !== 0) return fail(400, "invalid_request");
    const before = myVotes.get(article.id) ?? 0;
    article.upvotes = (article.upvotes ?? 0) - (before === 1 ? 1 : 0) + (value === 1 ? 1 : 0);
    article.downvotes = (article.downvotes ?? 0) - (before === -1 ? 1 : 0) + (value === -1 ? 1 : 0);
    if (value === 0) myVotes.delete(article.id);
    else myVotes.set(article.id, value);
    recordVote(request, "articles", article.id, value);
    return HttpResponse.json({ up: article.upvotes, down: article.downvotes, mine: value });
  }),
  // A read of our article page, sent by the browser: no body, 204 (as for blog posts).
  http.post(`${API}/articles/:id/view`, ({ params }) => {
    const article = articles.find((item) => item.id === Number(params.id));
    if (!article) return fail(404, "not_found");
    article.views = (article.views ?? 0) + 1;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API}/articles/:id/comments`, async ({ params, request }) => {
    const refused = gateRefusal(request);
    if (refused) return refused;
    const parsed = newCommentSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    const reader = readerOf(request);
    const reserved = reader ? null : teamName("username", parsed.data.username);
    if (reserved) return reserved;
    if (!reader && !parsed.data.recaptchaToken) return fail(403, "recaptcha_failed");
    const { body, parentId } = parsed.data;
    // With an account the comment carries its username; any name sent is ignored.
    const username = reader ? reader.username : parsed.data.username;
    // Comments containing these words simulate API failures in tests.
    if (body.includes("ERRO-SERVIDOR")) return fail(500, "internal_error");
    if (body.includes("ERRO-LIMITE")) return fail(429, "rate_limited");
    // An email: refused text, with the API's own words to show.
    if (body.includes("@exemplo.pt"))
      return HttpResponse.json(
        { error: { code: "personal_data", message: "O comentário tem um email ou um número de telefone. Retira-o e publica outra vez." } },
        { status: 400 },
      );

    const articleId = Number(params.id);
    const created = {
      id: nextCommentId++,
      articleId,
      parentId: parentId ?? null,
      username: username || null,
      parentUsername: null,
      body,
      createdAt: new Date().toISOString(),
      account: Boolean(reader),
    };
    store.set(articleId, [...(store.get(articleId) ?? []), created]);
    return HttpResponse.json(created, { status: 201 });
  }),
  ...contractHandlers,
  ...placeHandlers,
  ...legislatureHandlers,
  ...agendaHandlers,
  ...feedbackHandlers,
  ...forumHandlers,
  ...storyHandlers,
  ...adminHandlers,
  ...accountHandlers,
  ...engagementHandlers,
  ...editorialAdminHandlers,
  ...presidencyHandlers,
  ...peopleHandlers,
  ...becomeDeputyHandlers,
  ...sitemapHandlers,
  ...partyVoteHandlers,
];

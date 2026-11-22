import { http, HttpResponse } from "msw";
import { articles } from "./fixtures";
import { recordListVote } from "./accountFixtures";

/**
 * Stories (the backend's docs/stories-api.md), made from the test articles: article 100 is told by four outlets
 * (100, 95, 90, 85); every other article is a story of one, with the article's id as the story's.
 */
const API = "*/api/v2";
const fail = (status: number, code: string) => HttpResponse.json({ error: { code, message: code } }, { status });

const GROUPS: number[][] = [[100, 95, 90, 85]];
const grouped = new Set(GROUPS.flat());
const groups = [...GROUPS, ...articles.filter((article) => !grouped.has(article.id)).map((article) => [article.id])];
for (const group of groups) for (const id of group) articles.find((article) => article.id === id)!.storyId = group[0];

/** Readers' marks, and this mock reader's own. */
const importa = new Map<number, number>([
  [100, 14],
  [98, 6],
  [97, 3],
]);
const mine = new Set<number>();

type StoryComment = {
  id: number;
  storyId: number;
  parentId: number | null;
  username: string | null;
  parentUsername: string | null;
  body: string;
  stance: "agree" | "disagree" | null;
  likes: number;
  createdAt: string;
};
const storyComments = new Map<number, StoryComment[]>([
  [
    100,
    [
      {
        id: 9001,
        storyId: 100,
        parentId: null,
        username: "rita",
        parentUsername: null,
        body: "Se as medidas baixam a renda, venham de onde vierem.",
        stance: "agree",
        likes: 9,
        createdAt: "2026-10-30T13:30:00.000Z",
      },
      {
        id: 9002,
        storyId: 100,
        parentId: null,
        username: null,
        parentUsername: null,
        body: "É vago. Sem saber quais, é só uma frase para os jornais.",
        stance: "disagree",
        likes: 7,
        createdAt: "2026-10-30T14:10:00.000Z",
      },
    ],
  ],
]);
let nextId = 9100;
const OE2027 = { slug: "oe2027", label: "OE2027", name: "Orçamento do Estado para 2027", kind: "event" };
const HABITACAO = { slug: "habitacao", label: "Habitação", name: "Habitação e urbanismo", kind: "topic" };

/** The most liked comment on each side, as the API picks them. */
function debateOf(id: number) {
  const comments = storyComments.get(id) ?? [];
  const best = (stance: "agree" | "disagree") =>
    comments.filter((item) => item.stance === stance && item.likes > 0).sort((a, b) => b.likes - a.likes)[0] ?? null;
  const pick = (comment: StoryComment | null) =>
    comment && { id: comment.id, username: comment.username, body: comment.body, likes: comment.likes, createdAt: comment.createdAt };
  return { agree: pick(best("agree")), disagree: pick(best("disagree")) };
}

function storyOf(group: number[]) {
  const versions = group
    .map((id) => articles.find((article) => article.id === id)!)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const head = articles.find((article) => article.id === group[0])!;
  const marks = importa.get(group[0]!) ?? 0;
  const busiest = Math.max(...importa.values(), 1);
  return {
    id: group[0]!,
    title: head.title,
    excerpt: head.excerpt,
    imageUrl: head.imageUrl,
    firstPublishedAt: versions[0]!.publishedAt,
    lastPublishedAt: versions.at(-1)!.publishedAt,
    articleCount: versions.length,
    sourceCount: new Set(versions.map((item) => item.source)).size,
    sources: versions.map((item) => ({
      name: item.source,
      articleId: item.id,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      // Each outlet's own photo, as asked of the backend.
      imageUrl: item.imageUrl,
    })),
    parties: [...new Map(versions.flatMap((item) => item.parties).map((party) => [party.slug, party])).values()],
    deputies: [],
    government: [],
    president: null,
    initiatives:
      group[0] === 100
        ? [
            {
              id: 1,
              title: "Orçamento do Estado para 2027",
              status: "in_progress",
              lastVote: { date: "2026-10-31", phase: "Generalidade", result: "Aprovado", unanimous: false },
            },
          ]
        : [],
    importa: marks,
    importance: marks / busiest,
    tags: group[0] === 100 ? [OE2027, HABITACAO] : [],
    debate: debateOf(group[0]!),
    // The ids of older stories joined into this one (docs/stories-api.md): none here.
    mergedFrom: [] as number[],
    commentCount: (storyComments.get(group[0]!) ?? []).length + versions.reduce((sum, item) => sum + item.commentCount, 0),
  };
}

const stories = () => groups.map(storyOf);

export const storyHandlers = [
  http.get(`${API}/stories`, ({ request }) => {
    const search = new URL(request.url).searchParams;
    const sort = search.get("sort") ?? "newest";
    if (!["newest", "top", "coverage", "comments"].includes(sort)) return fail(400, "invalid_request");
    const limit = Number(search.get("limit") ?? 10);
    const party = (search.get("party") ?? "").split(",").filter(Boolean);
    const source = (search.get("source") ?? "").split(",").filter(Boolean);
    const words = (search.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const ids = search.get("ids")?.split(",").map(Number);
    const tag = search.get("tag");
    let list = stories().filter(
      (story) =>
        (!ids || ids.includes(story.id)) &&
        (!tag || story.tags.some((item) => item.slug === tag)) &&
        (sort !== "comments" || story.commentCount > 0) &&
        (party.length === 0 || story.parties.some((item) => party.includes(item.slug))) &&
        (source.length === 0 || story.sources.some((item) => source.includes(item.name))) &&
        words.every((word) => story.sources.some((item) => item.title.toLowerCase().includes(word))),
    );
    list.sort((a, b) => b.lastPublishedAt.localeCompare(a.lastPublishedAt));
    if (sort === "top") list.sort((a, b) => b.importa - a.importa);
    if (sort === "coverage") list.sort((a, b) => b.sourceCount - a.sourceCount);
    if (sort === "comments") list.sort((a, b) => b.commentCount - a.commentCount);
    const cursor = search.get("cursor");
    const start = cursor ? Number(cursor.slice(1)) : 0;
    const total = list.length;
    list = list.slice(start, start + limit);
    return HttpResponse.json({ items: list, nextCursor: start + limit < total ? `s${start + limit}` : null, total });
  }),
  http.get(`${API}/stories/:id`, ({ params }) => {
    const group = groups.find((item) => item[0] === Number(params.id));
    if (!group) return fail(404, "not_found");
    return HttpResponse.json({
      ...storyOf(group),
      articles: group.map((id) => articles.find((article) => article.id === id)!),
      context:
        group[0] === 100
          ? {
              explainers: [
                {
                  slug: "o-que-muda-no-orcamento",
                  title: "O que muda no Orçamento",
                  kind: "article",
                  publishedAt: "2026-10-20T10:00:00.000Z",
                },
              ],
              agenda: [
                {
                  id: "ar-1",
                  title: "Votação final global do OE2027",
                  kind: "parliament",
                  startsAt: "2026-11-27T15:00:00.000Z",
                  allDay: false,
                },
              ],
            }
          : { explainers: [], agenda: [] },
    });
  }),
  http.get(`${API}/today`, () => {
    const list = stories()
      .sort((a, b) => b.sourceCount + Math.min(5, b.importa / 2) - (a.sourceCount + Math.min(5, a.importa / 2)))
      .slice(0, 5);
    // recentSourceCount: the outlets in the last 24 hours (all of them, in these fixtures).
    return HttpResponse.json({
      items: list.map((item) => ({ ...item, recentSourceCount: item.sourceCount })),
      since: "2026-10-29T12:00:00.000Z",
    });
  }),
  http.post(`${API}/stories/:id/vote`, async ({ params, request }) => {
    const id = Number(params.id);
    if (!groups.some((item) => item[0] === id)) return fail(404, "not_found");
    const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
    if (body?.value !== 1 && body?.value !== 0) return fail(400, "invalid_request");
    const had = mine.has(id);
    if (body.value === 1 && !had) {
      mine.add(id);
      importa.set(id, (importa.get(id) ?? 0) + 1);
    }
    if (body.value === 0 && had) {
      mine.delete(id);
      importa.set(id, (importa.get(id) ?? 1) - 1);
    }
    const story = storyOf(groups.find((item) => item[0] === id)!);
    return HttpResponse.json({ importa: story.importa, importance: story.importance, mine: body.value });
  }),
  http.get(`${API}/stories/:id/comments`, ({ params }) => {
    const id = Number(params.id);
    if (!groups.some((item) => item[0] === id)) return fail(404, "not_found");
    return HttpResponse.json(storyComments.get(id) ?? []);
  }),
  http.post(`${API}/stories/:id/comments`, async ({ params, request }) => {
    const id = Number(params.id);
    if (!groups.some((item) => item[0] === id)) return fail(404, "not_found");
    const body = (await request.json()) as { body?: string; username?: string; parentId?: number; stance?: "agree" | "disagree" };
    if (!body.body?.trim()) return fail(400, "invalid_request");
    // As on the article comments: this text stands for a server failure.
    if (body.body.trim() === "ERRO-SERVIDOR") return fail(500, "internal_error");
    if (body.body.includes("@exemplo.pt"))
      return HttpResponse.json(
        { error: { code: "personal_data", message: "O comentário tem um email ou um número de telefone. Retira-o e publica outra vez." } },
        { status: 400 },
      );
    const created: StoryComment = {
      id: nextId++,
      storyId: id,
      parentId: body.parentId ?? null,
      username: body.username ?? null,
      parentUsername: null,
      body: body.body,
      stance: body.stance ?? null,
      // The author's own like counts (the API, since November 2026).
      likes: 1,
      createdAt: new Date().toISOString(),
    };
    storyComments.set(id, [...(storyComments.get(id) ?? []), created]);
    recordListVote(request, "comments", created.id, true);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post(`${API}/comments/:id/like`, async ({ params, request }) => {
    const id = Number(params.id);
    const comment = [...storyComments.values()].flat().find((item) => item.id === id);
    if (!comment) return fail(404, "not_found");
    const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
    if (body?.value !== 1 && body?.value !== 0) return fail(400, "invalid_request");
    // Every test reader is a new one: a like adds one, taking it back removes one.
    comment.likes = Math.max(0, comment.likes + (body.value === 1 ? 1 : -1));
    recordListVote(request, "comments", id, body.value === 1);
    return HttpResponse.json({ likes: comment.likes, mine: body.value });
  }),
];

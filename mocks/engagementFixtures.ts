import { http, HttpResponse } from "msw";
import { readerOf, type MockReader } from "./accountFixtures";
import { publicPosts } from "./editorialAdmin";
import { addVoteThread, forumItem, registerPickLookup } from "./forumFixtures";
import { initiatives } from "./parliamentFixtures";

/*
 * The engagement endpoints (backend docs/engagement-api.md), in memory: the inbox, "Seguir", "Passa na próxima
 * votação?" and the saved page. Fictional people and numbers.
 */

const API = "*/api/v2";
const fail = (status: number, code: string, message = code) => HttpResponse.json({ error: { code, message } }, { status });
const noContent = () => new HttpResponse(null, { status: 204 });
type Params = Record<string, string | readonly string[] | undefined>;
const withReader =
  (handle: (reader: MockReader, request: Request, params: Params) => Response | Promise<Response>) =>
  ({ request, params }: { request: Request; params: Params }) => {
    const reader = readerOf(request);
    return reader ? handle(reader, request, params) : fail(401, "unauthenticated", "Log in first");
  };

const LINK = { commentId: null, articleId: null, storyId: null, postSlug: null, threadId: null, postId: null, initiativeId: null };
const EXTRA = { threadTitle: null, board: null, headline: null, prediction: null };

/** Each reader's inbox, seeded on first look: a reply, a followed thread and a settled prediction. */
const inboxes = new Map<number, ReturnType<typeof seedInbox>>();
function seedInbox() {
  return [
    {
      id: 3,
      kind: "comment_reply",
      actorName: "rui_teste",
      count: 1,
      createdAt: "2026-11-18T09:30:00.000Z",
      read: false,
      snippet: "Discordo de ti, mas é um bom ponto.",
      link: { ...LINK, commentId: 1, articleId: 100 },
      ...EXTRA,
    },
    {
      id: 2,
      kind: "thread_update",
      actorName: "ana_exemplo",
      count: 3,
      createdAt: "2026-11-18T08:00:00.000Z",
      read: false,
      snippet: null,
      link: { ...LINK, threadId: 8 },
      ...EXTRA,
      threadTitle: "O que acham do debate do orçamento?",
      board: "geral",
    },
    {
      id: 1,
      kind: "prediction_result",
      actorName: null,
      count: 1,
      createdAt: "2026-11-17T04:05:00.000Z",
      read: true,
      snippet: null,
      link: { ...LINK, initiativeId: 5000 },
      ...EXTRA,
      prediction: {
        initiativeTitle: "Iniciativa de teste sobre habitação",
        pick: "pass" as const,
        outcome: "hit" as const,
        result: "Aprovado",
      },
    },
  ];
}
const inboxOf = (reader: MockReader) => {
  if (!inboxes.has(reader.id)) inboxes.set(reader.id, seedInbox());
  return inboxes.get(reader.id)!;
};

/** Open predictions: the first few initiatives; the crowd's picks, and each reader's. */
const OPEN = initiatives.slice(0, 4).map((item, index) => ({
  id: item.id,
  type: item.type ?? "Projeto de Lei",
  number: item.number ?? null,
  title: item.title,
  phase: index === 0 ? "Votação na generalidade" : "Discussão generalidade",
  phaseDate: "2026-11-20",
  onAgenda: index < 2,
  // On the agenda within 7 days; picks lock when the session starts.
  closesAt: new Date(Date.now() + (index === 0 ? 134 : index * 24 * 60 + 60) * 60_000).toISOString(),
  threadId: 700 + index,
}));
for (const item of OPEN) addVoteThread(item.threadId, { id: item.id, title: item.title });
/** A vote already settled: the readers' split shows to everyone. */
const DECIDED = {
  id: initiatives[4]!.id,
  title: initiatives[4]!.title,
  state: "decided" as const,
  closesAt: "2026-11-13T15:00:00.000Z",
  threadId: 704,
  split: { pass: 31, fail: 18 },
  voteDate: "2026-11-04",
  voteResult: "Rejeitado",
};
addVoteThread(DECIDED.threadId, { id: DECIDED.id, title: DECIDED.title });
const crowd = new Map<number, { pass: number; fail: number }>(OPEN.map((item, index) => [item.id, { pass: 12 - index, fail: 7 + index }]));
const picks = new Map<number, Map<number, "pass" | "fail">>();
const picksOf = (reader: MockReader) => {
  if (!picks.has(reader.id)) picks.set(reader.id, new Map());
  return picks.get(reader.id)!;
};
registerPickLookup((readerId, initiativeId) => picks.get(readerId)?.get(initiativeId) ?? null);

let commentLookup: (
  id: number,
) => { id: number; body: string; username: string | null; createdAt: string; articleId: number } | null = () => null;
/** The article comments live in handlers.ts; it hands over how to find one. */
export const registerCommentLookup = (lookup: typeof commentLookup) => {
  commentLookup = lookup;
};

const SAVED_AT = "2026-11-18T10:00:00.000Z";

export const engagementHandlers = [
  http.get(
    `${API}/me/notifications`,
    withReader((reader) => HttpResponse.json({ items: inboxOf(reader), nextCursor: null })),
  ),
  http.get(
    `${API}/me/notifications/unread`,
    withReader((reader) => HttpResponse.json({ count: inboxOf(reader).filter((item) => !item.read).length })),
  ),
  http.post(
    `${API}/me/notifications/read`,
    withReader(async (reader, request) => {
      const body = (await request.json().catch(() => ({}))) as { ids?: number[] };
      for (const item of inboxOf(reader)) if (!body.ids || body.ids.includes(item.id)) item.read = true;
      return noContent();
    }),
  ),

  ...(["put", "delete"] as const).map((method) =>
    http[method](
      `${API}/me/follows/:kind/:id`,
      withReader((reader, _request, params) => {
        const list = params.kind === "story" ? "stories" : params.kind === "thread" ? "threads" : null;
        if (!list) return fail(404, "not_found");
        const id = Number(params.id);
        const rest = reader.follows[list].filter((item) => item !== id);
        reader.follows[list] = method === "put" ? [id, ...rest] : rest;
        return noContent();
      }),
    ),
  ),

  http.get(`${API}/predictions/open`, ({ request }) => {
    const reader = readerOf(request);
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 10);
    const mine = reader ? picksOf(reader) : null;
    return HttpResponse.json({
      items: OPEN.slice(0, limit).map((item) => {
        const pick = mine?.get(item.id) ?? null;
        return { ...item, myPick: pick, split: pick ? crowd.get(item.id) : null };
      }),
    });
  }),
  // One initiative's (proposed: GET /predictions/:initiativeId): the open ones, and one already decided.
  http.get(`${API}/predictions/:id`, ({ request, params }) => {
    const id = Number(params.id);
    const reader = readerOf(request);
    const mine = reader ? (picksOf(reader).get(id) ?? null) : null;
    const open = OPEN.find((item) => item.id === id);
    if (open)
      return HttpResponse.json({
        id,
        title: open.title,
        state: "open",
        closesAt: open.closesAt,
        threadId: open.threadId,
        myPick: mine,
        split: mine ? crowd.get(id) : null,
        voteDate: open.phaseDate,
        voteResult: null,
        outcome: null,
      });
    if (id === DECIDED.id) return HttpResponse.json({ ...DECIDED, myPick: null, outcome: null });
    return fail(404, "not_found");
  }),
  http.put(`${API}/predictions/:id`, async ({ request, params }) => {
    const reader = readerOf(request);
    if (!reader) return fail(401, "login_required", "Log in to take part");
    const id = Number(params.id);
    const split = crowd.get(id);
    if (!split) return fail(404, "not_found");
    const { pick } = (await request.json().catch(() => ({}))) as { pick?: string };
    if (pick !== "pass" && pick !== "fail") return fail(400, "validation_failed");
    const before = picksOf(reader).get(id);
    if (before) split[before] -= 1;
    split[pick] += 1;
    picksOf(reader).set(id, pick);
    // Picking follows the vote's thread.
    const thread = OPEN.find((item) => item.id === id)?.threadId;
    if (thread) reader.follows.threads = [thread, ...reader.follows.threads.filter((item) => item !== thread)];
    return HttpResponse.json({ pick, split });
  }),
  http.delete(`${API}/predictions/:id`, ({ request, params }) => {
    const reader = readerOf(request);
    if (!reader) return fail(401, "login_required", "Log in to take part");
    const id = Number(params.id);
    const before = picksOf(reader).get(id);
    if (before) crowd.get(id)![before] -= 1;
    picksOf(reader).delete(id);
    return noContent();
  }),
  http.get(
    `${API}/me/predictions`,
    withReader((reader) => {
      const pending = [...picksOf(reader)].map(([id, pick]) => {
        const item = OPEN.find((open) => open.id === id)!;
        return {
          initiativeId: id,
          title: item.title,
          pick,
          outcome: null,
          voteDate: null,
          voteResult: null,
          updatedAt: SAVED_AT,
          split: crowd.get(id),
        };
      });
      const settled = [
        {
          initiativeId: 5000,
          title: "Iniciativa de teste sobre habitação",
          pick: "pass" as const,
          outcome: "hit" as const,
          voteDate: "2026-11-16",
          voteResult: "Aprovado",
          updatedAt: "2026-11-14T10:00:00.000Z",
          split: { pass: 20, fail: 9 },
        },
      ];
      return HttpResponse.json({ record: { hits: 1, misses: 0, pending: pending.length, streak: 1 }, items: [...pending, ...settled] });
    }),
  ),

  http.get(
    `${API}/me/saved`,
    withReader((reader) => {
      const posts = publicPosts();
      return HttpResponse.json({
        editorial: reader.saved.editorial.flatMap((id) => {
          const post = posts.find((item) => item.id === id);
          return post
            ? [
                {
                  savedAt: SAVED_AT,
                  id,
                  slug: post.slug,
                  kind: post.kind,
                  title: post.title,
                  subtitle: post.subtitle ?? null,
                  coverImageUrl: null,
                  publishedAt: post.publishedAt,
                },
              ]
            : [];
        }),
        comments: reader.saved.comments.flatMap((id) => {
          const comment = commentLookup(id);
          return comment ? [{ savedAt: SAVED_AT, ...comment, likes: 0, storyId: null, postSlug: null }] : [];
        }),
        threads: reader.saved.threads.flatMap((id) => {
          const thread = forumItem("thread", id);
          return thread && "title" in thread
            ? [
                {
                  savedAt: SAVED_AT,
                  id,
                  board: thread.board,
                  title: thread.title,
                  nickname: thread.nickname,
                  score: thread.score ?? 0,
                  replyCount: thread.replyCount,
                  createdAt: thread.createdAt,
                },
              ]
            : [];
        }),
        replies: reader.saved.replies.flatMap((id) => {
          const post = forumItem("post", id);
          return post && "threadTitle" in post
            ? [
                {
                  savedAt: SAVED_AT,
                  id,
                  threadId: post.threadId,
                  threadTitle: post.threadTitle,
                  board: post.board,
                  body: post.body,
                  nickname: post.nickname,
                  createdAt: post.createdAt,
                },
              ]
            : [];
        }),
      });
    }),
  ),
];

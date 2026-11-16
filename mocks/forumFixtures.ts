import { http, HttpResponse } from "msw";
import { z } from "zod";
import { parties } from "./fixtures";

const API = "*/api/v2";

type MockThread = {
  id: number;
  board: string;
  title: string;
  body: string;
  nickname: string | null;
  posterId: string;
  createdAt: string;
  bumpedAt: string;
  pinned: boolean;
  locked: boolean;
  link: { article: { id: number; title: string } | null; initiative: { id: number; title: string } | null } | null;
  /** Only on the ideas board: upvotes, and what the team decided. */
  score?: number;
  status?: "reviewing" | "planned" | "in_progress" | "done" | "declined" | null;
  answer?: string | null;
  answeredAt?: string | null;
};
type MockPost = {
  id: number;
  threadId: number;
  body: string;
  nickname: string | null;
  posterId: string;
  replyTo: number | null;
  createdAt: string;
  hidden: boolean;
};

const BOARDS = [
  { board: "geral", name: "Geral", acronym: null as string | null },
  { board: "ideias", name: "Ideias", acronym: null as string | null },
  ...parties.map((p) => ({ board: p.slug, name: p.name, acronym: p.acronym })),
];

const hoursAgo = (hours: number) => new Date(Date.UTC(2026, 10, 15, 12) - hours * 3_600_000).toISOString();

/** Fictional posters; the IDs are made up, as the real ones are derived from the IP. */
const idea = (
  id: number,
  title: string,
  body: string,
  score: number,
  status: MockThread["status"],
  hours: number,
  answer: string | null = null,
) => ({
  id,
  board: "ideias",
  title,
  body,
  nickname: null,
  posterId: `Idea${String(id).padStart(4, "0")}`,
  createdAt: hoursAgo(hours),
  bumpedAt: hoursAgo(hours / 2),
  pinned: false,
  locked: false,
  link: null,
  score,
  status,
  answer,
  answeredAt: answer ? hoursAgo(hours / 3) : null,
});

const threads: MockThread[] = [
  idea(
    501,
    "Alertas quando um deputado do meu distrito vota",
    "Gostava de receber um aviso quando os deputados do meu círculo votam uma lei.",
    214,
    "in_progress",
    400,
    "Estamos a fazer: primeiro por email, depois no telemóvel.",
  ),
  idea(502, "Comparar dois partidos lado a lado", "Escolher dois partidos e ver como votaram nas mesmas leis.", 158, "planned", 300),
  idea(503, "Modo de leitura sem imagens", "Para poupar dados no telemóvel.", 97, "reviewing", 120),
  idea(
    504,
    "Filtrar a agenda pelo meu concelho",
    "Ver só os eventos perto de mim.",
    61,
    "done",
    600,
    "Feito: a agenda já filtra por distrito.",
  ),
  idea(505, "Exportar votações em CSV", "Para quem quer fazer as próprias contas.", 12, null, 5),
  {
    id: 7,
    board: "geral",
    title: "Regras do fórum: lê antes de publicar",
    body: "Sê civilizado. Sem dados pessoais.\nDenuncia o que violar as regras.",
    nickname: "Moderação",
    posterId: "Mod00001",
    createdAt: hoursAgo(300),
    bumpedAt: hoursAgo(300),
    pinned: true,
    locked: true,
    link: null,
  },
  {
    id: 8,
    board: "geral",
    title: "O que acham do debate do orçamento?",
    body: "Vi a notícia e fiquei com dúvidas. Mais em https://example.org/orcamento.\nAlguém percebe as contas?",
    nickname: null,
    posterId: "Xk3_a9Qz",
    createdAt: hoursAgo(30),
    bumpedAt: hoursAgo(2),
    pinned: false,
    locked: false,
    link: { article: { id: 100, title: "Notícia de teste número 100: Parlamento debate o orçamento & a saúde" }, initiative: null },
  },
  {
    id: 9,
    board: "geral",
    title: "<script>window.__forumXss=1</script> título hostil",
    body: '<img src=x onerror="window.__forumXss=1"> [clica](javascript:alert(1)) javascript:alert(1)',
    nickname: "<b>Zé</b>",
    posterId: "pQ8-m2Lr",
    createdAt: hoursAgo(10),
    bumpedAt: hoursAgo(10),
    pinned: false,
    locked: false,
    link: null,
  },
  {
    id: 10,
    board: "ps",
    title: "Propostas para a habitação",
    body: "Que propostas do partido vos parecem melhores?",
    nickname: "Inês Calado",
    posterId: "Hb7-Qa2W",
    createdAt: hoursAgo(50),
    bumpedAt: hoursAgo(5),
    pinned: false,
    locked: false,
    link: { article: null, initiative: { id: 5000, title: "Iniciativa de teste sobre habitação" } },
  },
];

const posts: MockPost[] = [
  {
    id: 31,
    threadId: 8,
    body: "Concordo, as contas são confusas.",
    nickname: null,
    posterId: "pQ8-m2Lr",
    replyTo: null,
    createdAt: hoursAgo(20),
    hidden: false,
  },
  {
    id: 32,
    threadId: 8,
    body: "Insulto removido",
    nickname: null,
    posterId: "Zz9-aa11",
    replyTo: 31,
    createdAt: hoursAgo(10),
    hidden: true,
  },
  {
    id: 33,
    threadId: 8,
    body: ">>31\nTambém acho. Quem abriu explica melhor?",
    nickname: "Rita M.",
    posterId: "Lm2_Pq7z",
    replyTo: 31,
    createdAt: hoursAgo(4),
    hidden: false,
  },
  {
    id: 34,
    threadId: 8,
    body: ">>33 Explico: as contas estão no relatório.",
    nickname: null,
    posterId: "Xk3_a9Qz",
    replyTo: 33,
    createdAt: hoursAgo(2),
    hidden: false,
  },
  {
    id: 35,
    threadId: 10,
    body: "As cooperativas.",
    nickname: null,
    posterId: "Uu4-Ty6R",
    replyTo: null,
    createdAt: hoursAgo(5),
    hidden: false,
  },
];

let nextThreadId = 600;
let nextPostId = 900;

const fail = (status: number, code: string) => HttpResponse.json({ error: { code, message: code } }, { status });
const replyCount = (thread: MockThread) => posts.filter((post) => post.threadId === thread.id).length;
const summary = (thread: MockThread) => {
  const { body, ...rest } = thread;
  return { ...rest, excerpt: body.slice(0, 300), replyCount: replyCount(thread) };
};
const posterFor = (threadId: number) => `Tu${String(threadId).padStart(6, "0")}`.slice(0, 8);

// Mirrors the real API, which rejects unknown fields.
const newThreadSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(1).max(5000),
  nickname: z.string().trim().max(40).nullish(),
  articleId: z.number().int().positive().nullish(),
  initiativeId: z.number().int().positive().nullish(),
  recaptchaToken: z.string().min(1),
});
const newPostSchema = z.strictObject({
  body: z.string().trim().min(1).max(5000),
  nickname: z.string().trim().max(40).nullish(),
  replyTo: z.number().int().positive().nullish(),
  recaptchaToken: z.string().min(1),
});
const reportSchema = z.strictObject({
  kind: z.enum(["thread", "post", "comment"]),
  id: z.number().int().positive(),
  reason: z.enum(["spam", "insult", "hate", "personal_data", "illegal", "other"]),
  details: z.string().trim().max(500).nullish(),
});

export const forumHandlers = [
  http.get(`${API}/forums`, () =>
    HttpResponse.json({
      items: BOARDS.map((board) => {
        const own = threads.filter((thread) => thread.board === board.board);
        return {
          ...board,
          threads: own.length,
          posts: own.length + own.reduce((sum, thread) => sum + replyCount(thread), 0),
          lastActivity:
            own
              .map((thread) => thread.bumpedAt)
              .sort()
              .at(-1) ?? null,
        };
      }),
    }),
  ),

  http.get(`${API}/forums/threads/:id`, ({ params, request }) => {
    const thread = threads.find((item) => item.id === Number(params.id));
    if (!thread) return fail(404, "not_found");
    const after = Number(new URL(request.url).searchParams.get("after") ?? 0);
    const own = posts.filter((post) => post.threadId === thread.id && post.id > after);
    return HttpResponse.json({
      thread: { ...thread, replyCount: replyCount(thread) },
      posts: own.map((post) => ({
        id: post.id,
        nickname: post.nickname,
        replyTo: post.replyTo,
        createdAt: post.createdAt,
        hidden: post.hidden,
        body: post.hidden ? null : post.body,
        posterId: post.hidden ? null : post.posterId,
        isOp: !post.hidden && post.posterId === thread.posterId,
      })),
      hasMore: false,
    });
  }),

  http.get(`${API}/forums/:board/threads`, ({ params, request }) => {
    if (!BOARDS.some((board) => board.board === params.board)) return fail(404, "not_found");
    const query = new URL(request.url).searchParams;
    const sort = query.get("sort") ?? "active";
    const page = Number(query.get("page") ?? 1);
    const limit = Number(query.get("limit") ?? 25);
    const status = query.get("status");
    const own = threads
      .filter((thread) => thread.board === params.board && (!status || thread.status === status))
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          (sort === "new"
            ? b.createdAt.localeCompare(a.createdAt)
            : sort === "top"
              ? (b.score ?? 0) - (a.score ?? 0) || replyCount(b) - replyCount(a) || b.bumpedAt.localeCompare(a.bumpedAt)
              : b.bumpedAt.localeCompare(a.bumpedAt)),
      );
    return HttpResponse.json({ items: own.slice((page - 1) * limit, page * limit).map(summary), total: own.length });
  }),

  http.post(`${API}/forums/:board/threads`, async ({ params, request }) => {
    if (!BOARDS.some((board) => board.board === params.board)) return fail(404, "not_found");
    const parsed = newThreadSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    const { title, body, nickname, articleId, initiativeId } = parsed.data;
    if (body.includes("ERRO-LIMITE")) return fail(429, "rate_limited");
    const id = nextThreadId++;
    const now = new Date().toISOString();
    threads.push({
      id,
      board: String(params.board),
      title,
      body,
      nickname: nickname || null,
      posterId: posterFor(id),
      createdAt: now,
      bumpedAt: now,
      pinned: false,
      locked: false,
      ...(params.board === "ideias" ? { score: 0, status: null, answer: null, answeredAt: null } : {}),
      link:
        articleId || initiativeId
          ? {
              article: articleId ? { id: articleId, title: `Notícia de teste número ${articleId}` } : null,
              initiative: initiativeId ? { id: initiativeId, title: `Iniciativa ${initiativeId}` } : null,
            }
          : null,
    });
    return HttpResponse.json({ id, posterId: posterFor(id) }, { status: 201 });
  }),

  http.post(`${API}/forums/threads/:id/posts`, async ({ params, request }) => {
    const thread = threads.find((item) => item.id === Number(params.id));
    if (!thread) return fail(404, "not_found");
    if (thread.locked) return fail(409, "thread_locked");
    const parsed = newPostSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    const { body, nickname, replyTo } = parsed.data;
    if (body.includes("ERRO-LIMITE")) return fail(429, "rate_limited");
    if (replyTo && !posts.some((post) => post.id === replyTo && post.threadId === thread.id)) return fail(400, "invalid_reply");
    const id = nextPostId++;
    const posterId = posterFor(thread.id);
    const now = new Date().toISOString();
    posts.push({
      id,
      threadId: thread.id,
      body,
      nickname: nickname || null,
      posterId,
      replyTo: replyTo ?? null,
      createdAt: now,
      hidden: false,
    });
    thread.bumpedAt = now;
    return HttpResponse.json({ id, posterId }, { status: 201 });
  }),

  // One vote per reader on any board; the real API dedupes by a hash of the IP. Here every vote counts, which tests need.
  http.post(`${API}/forums/threads/:id/vote`, ({ params }) => {
    const thread = threads.find((item) => item.id === Number(params.id));
    if (!thread) return fail(404, "not_found");
    thread.score = (thread.score ?? 0) + 1;
    return HttpResponse.json({ score: thread.score });
  }),

  http.post(`${API}/reports`, async ({ request }) => {
    const parsed = reportSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    return new HttpResponse(null, { status: 202 });
  }),
];

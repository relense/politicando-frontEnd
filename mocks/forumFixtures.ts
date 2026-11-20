import { http, HttpResponse } from "msw";
import { z } from "zod";
import { looksLikeTeam } from "../lib/reservedNames";
import { parties } from "./fixtures";
import { addReport, audit, requireAdmin } from "./adminState";
import { readerOf } from "./accountFixtures";

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
  /** Hidden by the moderation: gone from the public site. */
  hidden?: boolean;
  link: { article: { id: number; title: string } | null; initiative: { id: number; title: string } | null } | null;
  /** Only on the ideas board: upvotes, and what the team decided. */
  score?: number;
  status?: "reviewing" | "planned" | "in_progress" | "done" | "declined" | "duplicate" | null;
  answer?: string | null;
  answeredAt?: string | null;
  followers?: number;
  expectedOn?: string | null;
  duplicateOf?: { id: number; title: string } | null;
  area?: string | null;
  statusHistory?: { status: MockThread["status"]; at: string }[];
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
  /** Only on the votes board: the poster's prediction. */
  pick?: "pass" | "fail" | null;
  /** Ideas board: written by the team (signed "Politicando"), and votes for the reply. */
  team?: boolean;
  score?: number;
};

const BOARDS = [
  { board: "geral", name: "Geral", acronym: null as string | null },
  { board: "ideias", name: "Ideias", acronym: null as string | null },
  { board: "votacoes", name: "Votações", acronym: null as string | null },
  ...parties.map((p) => ({ board: p.slug, name: p.name, acronym: p.acronym })),
];

const hoursAgo = (hours: number) => new Date(Date.UTC(2026, 10, 15, 12) - hours * 3_600_000).toISOString();

/** Fictional posters; the IDs are made up, as the real ones are derived from the IP. */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
type IdeaFields = Partial<MockThread> & { nickname?: string | null };
const idea = (
  id: number,
  title: string,
  body: string,
  score: number,
  status: MockThread["status"],
  hours: number,
  more: IdeaFields = {},
) => {
  const createdAt = hoursAgo(hours);
  return {
    id,
    board: "ideias",
    title,
    body,
    nickname: null,
    posterId: `Idea${String(id).padStart(4, "0")}`,
    createdAt,
    bumpedAt: hoursAgo(hours / 2),
    pinned: false,
    locked: false,
    link: null,
    score,
    status,
    answer: null,
    answeredAt: null,
    followers: Math.round(score / 2),
    expectedOn: null,
    duplicateOf: null,
    area: null,
    // Opened, then (when the team looked) straight to where it is now.
    statusHistory: [{ status: null, at: createdAt }, ...(status ? [{ status, at: hoursAgo(hours / 3) }] : [])],
    ...more,
  };
};

const threads: MockThread[] = [
  idea(
    501,
    "Votações na especialidade do Orçamento do Estado, à lupa",
    "Gostava de ver como cada partido votou cada proposta de alteração ao Orçamento, e não só o resultado da votação final. Hoje isto está espalhado por PDFs no site do Parlamento.",
    48,
    "in_progress",
    150,
    {
      nickname: "rita.t",
      followers: 23,
      area: "Orçamento",
      expectedOn: inDays(7),
      answer:
        "Boa ideia, e já está desenhada. Vai ser a página Orçamento do Estado: cada proposta de alteração, quem a propôs e o voto de cada partido.",
      answeredAt: hoursAgo(24),
      // Someone answered a few minutes ago: «a discutir agora».
      bumpedAt: minutesAgo(10),
      statusHistory: [
        { status: null, at: hoursAgo(150) },
        { status: "reviewing", at: hoursAgo(126) },
        { status: "planned", at: hoursAgo(30) },
        { status: "in_progress", at: hoursAgo(24) },
      ],
    },
  ),
  idea(
    502,
    "Alertas quando um deputado do meu distrito vota",
    "Escolho o meu distrito e recebo um aviso quando há votações importantes.",
    31,
    "reviewing",
    50,
  ),
  idea(
    503,
    "Comparar o programa eleitoral com o que cada partido votou",
    "Promessa a promessa, com a votação ao lado.",
    17,
    "reviewing",
    170,
  ),
  idea(
    504,
    "Modo de leitura sem imagens, para poupar dados",
    "No telemóvel, uma opção para não carregar imagens nas notícias.",
    14,
    "planned",
    500,
  ),
  idea(505, "Newsletter diária curta, em vez de semanal", "Um email por dia com o essencial.", 11, "declined", 700, {
    answer: "O Hoje em 5 já faz isto todos os dias, em áudio e texto. Preferimos melhorá-lo a ter dois resumos diários.",
    answeredAt: hoursAgo(600),
  }),
  idea(506, "Podcast Hoje em 5 no Spotify", "Para ouvir no carro sem abrir o site.", 8, "done", 800, {
    answer: "Feito a 10 nov. Procura «Politicando» no Spotify.",
    answeredAt: hoursAgo(130),
  }),
  idea(507, "Filtro por partido nas notícias", "Ver só as notícias de um partido.", 22, "done", 900),
  idea(508, "Tema claro", "Uma versão clara do site, para ler de dia.", 15, "done", 1000),
  idea(509, "Votações de cada partido no Orçamento", "Quem votou o quê em cada alteração ao Orçamento.", 6, "duplicate", 60, {
    duplicateOf: { id: 501, title: "Votações na especialidade do Orçamento do Estado, à lupa" },
  }),
  idea(510, "Exportar votações em CSV", "Para quem quer fazer as próprias contas.", 3, null, 5),
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

const ideaPost = (id: number, body: string, nickname: string, score: number, minutes: number, more: Partial<MockPost> = {}): MockPost => ({
  id,
  threadId: 501,
  body,
  nickname,
  posterId: `Ip${id}`,
  replyTo: null,
  createdAt: minutesAgo(minutes),
  hidden: false,
  team: false,
  score,
  ...more,
});

const posts: MockPost[] = [
  ideaPost(41, "Sim, por favor. E poder filtrar só as propostas do partido em que votei.", "miguel.s", 14, 2880),
  ideaPost(42, "Vai haver um filtro «Proposta por», com o logótipo de cada partido, igual ao das notícias.", "Politicando", 9, 1440, {
    posterId: "equipa",
    replyTo: 41,
    team: true,
  }),
  ideaPost(
    43,
    "O mais útil para mim era um resumo em linguagem simples do que cada proposta muda. Os títulos dos artigos não dizem nada.",
    "ana.r",
    8,
    4320,
  ),
  ideaPost(44, "Era bom também ver orçamentos de anos anteriores, para comparar.", "joao_p", 5, 5760),
  // The idea's author answering: OP.
  ideaPost(45, "Concordo, pelo menos desde 2020.", "rita.t", 2, 10, { posterId: "Idea0501", replyTo: 44 }),
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
// The timeline is only on an idea's own page, as in the API.
const summary = (thread: MockThread) => {
  const { body, ...rest } = thread;
  return { ...rest, statusHistory: undefined, excerpt: body.slice(0, 300), replyCount: replyCount(thread) };
};
/** Words to match, as the API: no accents or case, very common ones left out unless that's all there is. */
const COMMON = new Set(["que", "para", "mais", "com", "uma", "dos", "das", "nas", "nos", "por", "the"]);
const wordsOf = (text: string) => {
  const all = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
  const kept = all.filter((word) => !COMMON.has(word));
  return kept.length > 0 ? kept : all;
};
/** A word in the title counts twice as much as one in the body. */
const relevance = (thread: MockThread, words: string[]) => {
  const title = wordsOf(thread.title);
  const body = wordsOf(thread.body);
  return words.reduce(
    (sum, word) => sum + (title.some((w) => w.startsWith(word)) ? 2 : 0) + (body.some((w) => w.startsWith(word)) ? 1 : 0),
    0,
  );
};
const posterFor = (threadId: number) => `Tu${String(threadId).padStart(6, "0")}`.slice(0, 8);

// Mirrors the real API, which rejects unknown fields.
const newThreadSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(1).max(5000),
  nickname: z.string().trim().max(40).nullish(),
  articleId: z.number().int().positive().nullish(),
  initiativeId: z.number().int().positive().nullish(),
  area: z.string().trim().max(100).nullish(),
  recaptchaToken: z.string().min(1).nullish(),
});
const newPostSchema = z.strictObject({
  body: z.string().trim().min(1).max(5000),
  nickname: z.string().trim().max(40).nullish(),
  replyTo: z.number().int().positive().nullish(),
  recaptchaToken: z.string().min(1).nullish(),
});
// News articles take their own reasons; mixing the two lists is 400, as in the API.
const reportSchema = z.union([
  z.strictObject({
    kind: z.enum(["thread", "post", "comment"]),
    id: z.number().int().positive(),
    reason: z.enum(["spam", "insult", "hate", "personal_data", "illegal", "other"]),
    details: z.string().trim().max(500).nullish(),
  }),
  z.strictObject({
    kind: z.literal("article"),
    id: z.number().int().positive(),
    reason: z.enum(["wrong_tags", "broken_link", "duplicate", "not_politics", "other"]),
    details: z.string().trim().max(500).nullish(),
  }),
]);

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
    if (!thread || thread.hidden) return fail(404, "not_found");
    const query = new URL(request.url).searchParams;
    const after = Number(query.get("after") ?? 0);
    const sort = query.get("sort") ?? "old";
    const own = posts
      .filter((post) => post.threadId === thread.id && post.id > after)
      .sort((a, b) =>
        sort === "top"
          ? (b.score ?? 0) - (a.score ?? 0) || a.id - b.id
          : sort === "new"
            ? b.createdAt.localeCompare(a.createdAt)
            : a.id - b.id,
      );
    return HttpResponse.json({
      thread: {
        ...thread,
        replyCount: replyCount(thread),
        ...(thread.board === "ideias" ? { statusHistory: thread.statusHistory ?? [] } : {}),
      },
      posts: own.map((post) => ({
        id: post.id,
        nickname: post.nickname,
        replyTo: post.replyTo,
        createdAt: post.createdAt,
        hidden: post.hidden,
        body: post.hidden ? null : post.body,
        posterId: post.hidden ? null : post.posterId,
        isOp: !post.hidden && post.posterId === thread.posterId,
        ...(thread.board === "votacoes" ? { pick: post.hidden ? null : (post.pick ?? null) } : {}),
        team: post.team ?? false,
        score: thread.board === "ideias" ? (post.score ?? 0) : 0,
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
    const q = query.get("q");
    if (q !== null) {
      if (q.trim().length < 3) return fail(400, "invalid_request");
      const words = wordsOf(q);
      const found = threads
        .filter((thread) => thread.board === params.board && !thread.hidden)
        .map((thread) => ({ thread, rank: relevance(thread, words) }))
        .filter((entry) => entry.rank > 0)
        .sort((a, b) => b.rank - a.rank || (b.thread.score ?? 0) - (a.thread.score ?? 0))
        .map((entry) => entry.thread);
      return HttpResponse.json({ items: found.slice(0, limit).map(summary), total: found.length });
    }
    const own = threads
      .filter((thread) => thread.board === params.board && !thread.hidden && (!status || thread.status === status))
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

  http.get(`${API}/forums/threads/:id/similar`, ({ params, request }) => {
    const thread = threads.find((item) => item.id === Number(params.id));
    if (!thread || thread.hidden) return fail(404, "not_found");
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 3);
    const words = wordsOf(thread.title);
    const alike = threads
      .filter((item) => item.board === thread.board && item.id !== thread.id && !item.hidden)
      .map((item) => ({ item, shared: words.filter((word) => wordsOf(item.title).includes(word)).length }))
      .filter((entry) => entry.shared >= 2)
      .sort((a, b) => b.shared - a.shared || (b.item.score ?? 0) - (a.item.score ?? 0))
      .slice(0, limit)
      .map((entry) => summary(entry.item));
    return HttpResponse.json({ items: alike });
  }),

  http.post(`${API}/forums/:board/threads`, async ({ params, request }) => {
    if (!BOARDS.some((board) => board.board === params.board)) return fail(404, "not_found");
    // The site opens the votes board's threads; readers only reply.
    if (params.board === "votacoes") return fail(403, "board_closed");
    const parsed = newThreadSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    // With an account: no captcha, and the account's name. Opening an idea always needs one.
    const reader = readerOf(request);
    if (params.board === "ideias" && !reader) return fail(401, "login_required");
    if (!reader && !parsed.data.recaptchaToken) return fail(403, "recaptcha_failed");
    // As the API: a nickname that passes for the team is a plain validation error.
    if (!reader && parsed.data.nickname && looksLikeTeam(parsed.data.nickname))
      return HttpResponse.json({ error: { code: "invalid_request", message: "body/nickname That name is the team's" } }, { status: 400 });
    const { title, body, articleId, initiativeId } = parsed.data;
    const nickname = reader ? reader.username : parsed.data.nickname;
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
      ...(params.board === "ideias"
        ? {
            score: 0,
            status: null,
            answer: null,
            answeredAt: null,
            followers: 1,
            expectedOn: null,
            duplicateOf: null,
            area: parsed.data.area ?? null,
            statusHistory: [{ status: null, at: now }],
          }
        : {}),
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
    const reader = readerOf(request);
    if (!reader && !parsed.data.recaptchaToken) return fail(403, "recaptcha_failed");
    // As the API: a nickname that passes for the team is a plain validation error.
    if (!reader && parsed.data.nickname && looksLikeTeam(parsed.data.nickname))
      return HttpResponse.json({ error: { code: "invalid_request", message: "body/nickname That name is the team's" } }, { status: 400 });
    const { body, replyTo } = parsed.data;
    const nickname = reader ? reader.username : parsed.data.nickname;
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
      pick: thread.board === "votacoes" && reader && thread.link?.initiative ? pickOf(reader.id, thread.link.initiative.id) : null,
    });
    thread.bumpedAt = now;
    return HttpResponse.json({ id, posterId }, { status: 201 });
  }),

  // One vote per reader on any board; the real API dedupes by a hash of the IP. Here every vote counts, which tests need.
  // Voting on an idea needs an account.
  http.post(`${API}/forums/threads/:id/vote`, ({ params, request }) => {
    const thread = threads.find((item) => item.id === Number(params.id));
    if (!thread) return fail(404, "not_found");
    if (thread.board === "ideias" && !readerOf(request)) return fail(401, "login_required");
    // A vote on a duplicate counts on the original.
    const counted = thread.duplicateOf ? (threads.find((item) => item.id === thread.duplicateOf!.id) ?? thread) : thread;
    counted.score = (counted.score ?? 0) + 1;
    return HttpResponse.json({ score: counted.score });
  }),

  // Votes on replies: ideas board only, with an account.
  http.post(`${API}/forums/posts/:id/vote`, ({ params, request }) => {
    const post = posts.find((item) => item.id === Number(params.id) && !item.hidden);
    if (!post) return fail(404, "not_found");
    if (threads.find((item) => item.id === post.threadId)?.board !== "ideias") return fail(400, "not_an_idea");
    if (!readerOf(request)) return fail(401, "login_required");
    post.score = (post.score ?? 0) + 1;
    return HttpResponse.json({ score: post.score });
  }),

  http.post(`${API}/reports`, async ({ request }) => {
    const parsed = reportSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_request");
    addReport(parsed.data.kind, parsed.data.id, parsed.data.reason, parsed.data.details);
    return new HttpResponse(null, { status: 202 });
  }),

  // Moderation (docs/forums-api.md "Moderation").
  http.post(`${API}/admin/forum/threads/:id/:action`, ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const thread = threads.find((item) => item.id === Number(params.id));
    if (!thread) return fail(404, "not_found");
    const action = String(params.action);
    const changes: Record<string, Partial<MockThread>> = {
      hide: { hidden: true },
      unhide: { hidden: false },
      lock: { locked: true },
      unlock: { locked: false },
      pin: { pinned: true },
      unpin: { pinned: false },
    };
    if (!changes[action]) return fail(404, "not_found");
    Object.assign(thread, changes[action]);
    audit(admin, `thread.${action}`, "thread", thread.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API}/admin/forum/posts/:id/:action`, ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const post = posts.find((item) => item.id === Number(params.id));
    const action = String(params.action);
    if (!post || (action !== "hide" && action !== "unhide")) return fail(404, "not_found");
    post.hidden = action === "hide";
    audit(admin, `post.${action}`, "post", post.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

/** For the saved page: a visible thread or post, or null. */
/** A reader's pick on the vote a megathread is about (engagementFixtures hands it over). */
let pickOf: (readerId: number, initiativeId: number) => "pass" | "fail" | null = () => null;
export const registerPickLookup = (lookup: typeof pickOf) => {
  pickOf = lookup;
};

/** The site's thread for a vote on the plenary agenda, with two fictional replies from each side. */
export function addVoteThread(id: number, initiative: { id: number; title: string }) {
  if (threads.some((thread) => thread.id === id)) return;
  threads.push({
    id,
    board: "votacoes",
    title: `Passa ou chumba? ${initiative.title}`,
    body: "A conversa desta votação. Diz porque achas que passa, ou que chumba.",
    nickname: "Politicando",
    posterId: "redacao",
    createdAt: hoursAgo(30),
    bumpedAt: hoursAgo(2),
    pinned: true,
    locked: false,
    link: { article: null, initiative },
  });
  posts.push(
    {
      id: nextPostId++,
      threadId: id,
      body: "Os números estão lá: passa.",
      nickname: null,
      posterId: "aB3-x9Qe",
      replyTo: null,
      createdAt: hoursAgo(5),
      hidden: false,
      pick: "pass",
    },
    {
      id: nextPostId++,
      threadId: id,
      body: "Sem o voto do maior partido, chumba.",
      nickname: null,
      posterId: "Zt7-q1Lm",
      replyTo: null,
      createdAt: hoursAgo(3),
      hidden: false,
      pick: "fail",
    },
    {
      id: nextPostId++,
      threadId: id,
      body: "Atualização: o PSD anunciou abstenção.",
      nickname: "Politicando",
      posterId: "redacao",
      replyTo: null,
      createdAt: hoursAgo(2),
      hidden: false,
      pick: null,
    },
  );
}

export function forumItem(kind: "thread" | "post", id: number) {
  if (kind === "thread") {
    const thread = threads.find((item) => item.id === id && !item.hidden);
    return thread ? { ...thread, replyCount: posts.filter((post) => post.threadId === id && !post.hidden).length } : null;
  }
  const post = posts.find((item) => item.id === id && !item.hidden);
  const thread = post && threads.find((item) => item.id === post.threadId);
  return post && thread ? { ...post, threadTitle: thread.title, board: thread.board } : null;
}

/** For the reports queue: what a reported thread or post says. */
export function forumTarget(kind: "thread" | "post", id: number) {
  if (kind === "thread") {
    const thread = threads.find((item) => item.id === id);
    return thread
      ? { text: `${thread.title}\n${thread.body}`, hidden: Boolean(thread.hidden), threadId: thread.id, articleId: null }
      : null;
  }
  const post = posts.find((item) => item.id === id);
  return post ? { text: post.body, hidden: post.hidden, threadId: post.threadId, articleId: null } : null;
}

export function hideForum(kind: "thread" | "post", id: number) {
  if (kind === "thread") {
    const thread = threads.find((item) => item.id === id);
    if (thread) thread.hidden = true;
  } else {
    const post = posts.find((item) => item.id === id);
    if (post) post.hidden = true;
  }
}

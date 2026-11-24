import { z } from "zod";
import { ApiError, cached, request, screenedMessage, searchOf } from "./client";
import { standingMessage } from "./account";
import { reservedNameMessage } from "../reservedNames";

/* Anonymous forums: one board per party and a general one. Nobody signs in; each poster gets an ID per thread. */

const boardSchema = z.object({
  board: z.string(),
  name: z.string(),
  acronym: z.string().nullable(),
  threads: z.number(),
  posts: z.number(),
  lastActivity: z.string().nullable(),
});

const linkSchema = z.object({
  article: z.object({ id: z.number(), title: z.string() }).nullable(),
  initiative: z.object({ id: z.number(), title: z.string() }).nullable(),
});

const threadFields = {
  id: z.number(),
  board: z.string(),
  title: z.string(),
  nickname: z.string().nullable(),
  posterId: z.string(),
  replyCount: z.number(),
  createdAt: z.string(),
  bumpedAt: z.string(),
  pinned: z.boolean(),
  locked: z.boolean(),
  link: linkSchema.nullish(),
  // Only on the ideas board.
  score: z.number().nullish(),
  status: z.string().nullish(),
  answer: z.string().nullish(),
  answeredAt: z.string().nullish(),
  followers: z.number().nullish(),
  expectedOn: z.string().nullish(),
  duplicateOf: z.object({ id: z.number(), title: z.string() }).nullish().catch(null),
  area: z.string().nullish(),
};

const threadSummarySchema = z.object({ ...threadFields, excerpt: z.string() });

const postSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  nickname: z.string().nullable(),
  posterId: z.string().nullable(),
  isOp: z.boolean(),
  replyTo: z.number().nullable(),
  createdAt: z.string(),
  hidden: z.boolean(),
  // Only on the "Votações" board: what the poster predicted for that vote.
  pick: z.enum(["pass", "fail"]).nullable().optional().catch(null),
  // Written by the team (signed "Politicando"), and votes for the reply: ideas board only.
  team: z.boolean().nullish(),
  score: z.number().nullish(),
});

const threadDetailSchema = z.object({
  thread: z.object({
    ...threadFields,
    body: z.string(),
    statusHistory: z
      .array(z.object({ status: z.string().nullable(), at: z.string() }))
      .nullish()
      .catch(null),
  }),
  posts: z.array(postSchema),
  hasMore: z.boolean(),
  /** The next page in the same sort (`?cursor=`), null at the end. Opaque: pass it back as given. */
  nextCursor: z.string().nullable().catch(null),
});

const createdSchema = z.object({ id: z.number(), posterId: z.string() });

export type Board = { board: string; name: string; acronym: string | null; threads: number; posts: number; lastActivity: string | null };
export type ThreadLink = { kind: "article" | "initiative"; id: number; title: string } | null;
export type ThreadSummary = {
  id: number;
  board: string;
  title: string;
  excerpt: string;
  nickname: string | null;
  posterId: string;
  replyCount: number;
  createdAt: string;
  bumpedAt: string;
  pinned: boolean;
  locked: boolean;
  link: ThreadLink;
  /** Ideas board only: upvotes, what the team decided and its note; null elsewhere. */
  score: number | null;
  status: IdeaStatus | null;
  answer: string | null;
  answeredAt: string | null;
  /** Ideas board only: how many follow it, when the team expects it done, the original of a duplicate, the site area. */
  followers: number | null;
  expectedOn: string | null;
  duplicateOf: { id: number; title: string } | null;
  area: string | null;
};
export type IdeaStep = { status: IdeaStatus | null; at: string };
/** `statusHistory`: an idea's statuses, oldest first, from when it was opened; empty elsewhere. */
export type Thread = Omit<ThreadSummary, "excerpt"> & { body: string; statusHistory: IdeaStep[] };
export type ForumPost = {
  id: number;
  body: string | null;
  nickname: string | null;
  posterId: string | null;
  isOp: boolean;
  replyTo: number | null;
  createdAt: string;
  hidden: boolean;
  pick?: "pass" | "fail" | null;
  team: boolean;
  score: number;
};
export type ThreadDetail = { thread: Thread; posts: ForumPost[]; hasMore: boolean; nextCursor: string | null };
export type ThreadSort = "active" | "new" | "top";
/** A thread's replies: oldest first (the API's default), newest first, or most voted (ideas board). */
export type ReplySort = "old" | "new" | "top";

/** The board where readers propose ideas for the site and vote on them. */
export const IDEAS_BOARD = "ideias";
/** One thread per vote on the plenary agenda, opened by the site ("Passa ou chumba?"); readers reply, never open one. */
export const VOTES_BOARD = "votacoes";
export const IDEA_STATUSES = ["reviewing", "planned", "in_progress", "done", "declined", "duplicate"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export const IDEA_STATUS_LABELS: Record<IdeaStatus, { label: string; color: string }> = {
  reviewing: { label: "Em análise", color: "var(--muted)" },
  planned: { label: "Planeada", color: "var(--stage-debate)" },
  in_progress: { label: "Em desenvolvimento", color: "var(--link)" },
  done: { label: "Feita", color: "var(--stage-approved)" },
  declined: { label: "Não vamos fazer", color: "var(--danger)" },
  duplicate: { label: "Duplicada", color: "var(--muted)" },
};
const ideaStatusOf = (value: string | null | undefined): IdeaStatus | null => IDEA_STATUSES.find((status) => status === value) ?? null;
export type ReportReason =
  | "spam"
  | "insult"
  | "hate"
  | "personal_data"
  | "illegal"
  | "other"
  // News articles: about our tagging or the item, not what the outlet wrote.
  | "wrong_tags"
  | "broken_link"
  | "duplicate"
  | "not_politics";
export type ReportKind = "thread" | "post" | "comment" | "article";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  // As on 4chan, anything goes except what's illegal: these first (two reports hide the item), then spam (three);
  // insults and "other" only reach the moderators.
  { value: "illegal", label: "Ilegal (difamação, crime…)" },
  { value: "hate", label: "Ataque a um grupo" },
  { value: "personal_data", label: "Dados pessoais" },
  { value: "spam", label: "Spam ou publicidade" },
  { value: "insult", label: "Insulto ou assédio" },
  { value: "other", label: "Outro motivo" },
];

export const ARTICLE_REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "wrong_tags", label: "Partido ou pessoa errados" },
  { value: "broken_link", label: "Link não funciona" },
  { value: "duplicate", label: "Notícia repetida" },
  { value: "not_politics", label: "Não é sobre política" },
  { value: "other", label: "Outro motivo" },
];

export const THREAD_LIMITS = { title: [3, 150], body: 5000, nickname: 40 } as const;

/** The article or initiative a thread is about, at most one. */
export function mapThreadLink(link: z.infer<typeof linkSchema> | null | undefined): ThreadLink {
  if (link?.article) return { kind: "article", ...link.article };
  if (link?.initiative) return { kind: "initiative", ...link.initiative };
  return null;
}

const ideaFields = (thread: z.infer<typeof threadSummarySchema> | z.infer<typeof threadDetailSchema>["thread"]) => ({
  score: thread.score ?? null,
  status: ideaStatusOf(thread.status),
  answer: thread.answer?.trim() || null,
  answeredAt: thread.answeredAt ?? null,
  followers: thread.followers ?? null,
  expectedOn: thread.expectedOn ?? null,
  duplicateOf: thread.duplicateOf ?? null,
  area: thread.area?.trim() || null,
});

export function mapThreadSummary(thread: z.infer<typeof threadSummarySchema>): ThreadSummary {
  return { ...thread, ...ideaFields(thread), link: mapThreadLink(thread.link) };
}

export function mapThreadDetail(detail: z.infer<typeof threadDetailSchema>): ThreadDetail {
  const { statusHistory, ...thread } = detail.thread;
  return {
    ...detail,
    thread: {
      ...thread,
      ...ideaFields(detail.thread),
      link: mapThreadLink(thread.link),
      // A step with a status we don't know is left out rather than guessed.
      statusHistory: (statusHistory ?? [])
        .filter((step) => step.status === null || ideaStatusOf(step.status) !== null)
        .map((step) => ({ status: ideaStatusOf(step.status), at: step.at })),
    },
    posts: detail.posts.map((post) => ({ ...post, team: post.team ?? false, score: post.score ?? 0 })),
  };
}

/** "Zé (ID: Xk3_a9Qz)" or "Anónimo (ID: …)": nicknames are not unique, so the ID always goes with them. */
export const posterName = (nickname: string | null) => nickname?.trim() || "Anónimo";

export async function getBoards(): Promise<Board[]> {
  return (await request("/forums", z.object({ items: z.array(boardSchema) }), cached)).items;
}

export async function getThreads(
  board: string,
  { sort, page, limit, status, q }: { sort?: ThreadSort; page?: number; limit?: number; status?: IdeaStatus; q?: string } = {},
): Promise<{ items: ThreadSummary[]; total: number }> {
  const result = await request(
    `/forums/${encodeURIComponent(board)}/threads${searchOf({ sort, page, limit, status, q })}`,
    z.object({ items: z.array(threadSummarySchema), total: z.number() }),
    { cache: "no-store" },
  );
  return { items: result.items.map(mapThreadSummary), total: result.total };
}

/** A thread and a page of its replies: `after` for newer ones (oldest first, polling), `cursor` for the next page in any sort. */
export async function getThread(
  id: number,
  { after, sort, cursor }: { after?: number; sort?: ReplySort; cursor?: string } = {},
): Promise<ThreadDetail> {
  return mapThreadDetail(
    await request(`/forums/threads/${id}${searchOf({ after, sort: sort === "old" ? undefined : sort, cursor })}`, threadDetailSchema, {
      cache: "no-store",
    }),
  );
}

/** The search for ideas already proposed: at least 3 characters (the API answers 400 below that). */
export const IDEA_SEARCH_MIN = 3;
export async function searchIdeas(q: string, limit = 3): Promise<ThreadSummary[]> {
  if (q.trim().length < IDEA_SEARCH_MIN) return [];
  return (await getThreads(IDEAS_BOARD, { q: q.trim(), limit })).items;
}

/** Ideas that share words with this one's title, never itself; empty when nothing is alike enough. */
export async function getSimilarIdeas(id: number, limit = 3): Promise<ThreadSummary[]> {
  const result = await request(`/forums/threads/${id}/similar${searchOf({ limit })}`, z.object({ items: z.array(threadSummarySchema) }), {
    cache: "no-store",
  });
  return result.items.map(mapThreadSummary);
}

export type NewThread = {
  title: string;
  body: string;
  nickname: string;
  articleId: number | null;
  initiativeId: number | null;
  /** Null with an account. */
  captchaToken: string | null;
  /** Ideas board: the part of the site the idea is about. */
  area?: string | null;
};
export type NewPost = { body: string; nickname: string; replyTo: number | null; captchaToken: string | null };

const post = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function createThread(board: string, input: NewThread): Promise<{ id: number; posterId: string }> {
  // The API rejects unknown fields, so only send what it documents.
  return request(
    `/forums/${encodeURIComponent(board)}/threads`,
    createdSchema,
    post({
      title: input.title,
      body: input.body,
      ...(input.nickname ? { nickname: input.nickname } : {}),
      ...(input.articleId ? { articleId: input.articleId } : {}),
      ...(input.initiativeId ? { initiativeId: input.initiativeId } : {}),
      ...(input.area ? { area: input.area } : {}),
      ...(input.captchaToken ? { recaptchaToken: input.captchaToken } : {}),
    }),
  );
}

export async function createPost(threadId: number, input: NewPost): Promise<{ id: number; posterId: string }> {
  return request(
    `/forums/threads/${threadId}/posts`,
    createdSchema,
    post({
      body: input.body,
      ...(input.nickname ? { nickname: input.nickname } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.captchaToken ? { recaptchaToken: input.captchaToken } : {}),
    }),
  );
}

/** An upvote on an idea; the API counts one per reader and answers with the new score. */
export async function voteThread(id: number): Promise<number> {
  return (await request(`/forums/threads/${id}/vote`, z.object({ score: z.number() }), { method: "POST" })).score;
}

/** A vote for a reply on the ideas board: an account, once per reader, no undo; answers with the new score. */
export async function votePost(id: number): Promise<number> {
  return (await request(`/forums/posts/${id}/vote`, z.object({ score: z.number() }), { method: "POST" })).score;
}

export async function createReport(input: { kind: ReportKind; id: number; reason: ReportReason; details?: string }): Promise<void> {
  await request(
    "/reports",
    z.unknown(),
    post({ kind: input.kind, id: input.id, reason: input.reason, ...(input.details?.trim() ? { details: input.details.trim() } : {}) }),
  );
}

const FORUM_ERRORS: Record<string, string> = {
  login_required: "Entra na tua conta para publicar. O teu texto foi mantido.",
  recaptcha_failed: "A verificação anti-robô falhou. O teu texto foi mantido; confirma novamente e publica.",
  recaptcha_unavailable: "O fórum está temporariamente indisponível. O teu texto foi mantido; tenta daqui a pouco.",
  rate_limited: "Estás a publicar depressa demais. O teu texto foi mantido; espera um minuto e tenta novamente.",
  thread_locked: "Esta discussão foi fechada pela moderação e já não aceita respostas.",
  invalid_reply: "A mensagem a que estás a responder já não está nesta discussão.",
  not_found: "Esta discussão já não existe.",
  payload_too_large: "O texto é demasiado grande para enviar. Encurta-o; o teu texto foi mantido.",
};

/** A friendly message for a failed post, in Portuguese. */
export function forumErrorMessage(error: unknown): string {
  return (
    standingMessage(error) ||
    screenedMessage(error) ||
    reservedNameMessage(error) ||
    (error instanceof ApiError && error.code && FORUM_ERRORS[error.code]) ||
    "Não foi possível publicar. O teu texto foi mantido; tenta novamente."
  );
}

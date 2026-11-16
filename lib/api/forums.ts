import { z } from "zod";
import { ApiError, cached, request, searchOf } from "./client";

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
});

const threadDetailSchema = z.object({
  thread: z.object({ ...threadFields, body: z.string() }),
  posts: z.array(postSchema),
  hasMore: z.boolean(),
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
};
export type Thread = Omit<ThreadSummary, "excerpt"> & { body: string };
export type ForumPost = {
  id: number;
  body: string | null;
  nickname: string | null;
  posterId: string | null;
  isOp: boolean;
  replyTo: number | null;
  createdAt: string;
  hidden: boolean;
};
export type ThreadDetail = { thread: Thread; posts: ForumPost[]; hasMore: boolean };
export type ThreadSort = "active" | "new" | "top";

/** The board where readers propose ideas for the site and vote on them. */
export const IDEAS_BOARD = "ideias";
export const IDEA_STATUSES = ["reviewing", "planned", "in_progress", "done", "declined"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export const IDEA_STATUS_LABELS: Record<IdeaStatus, { label: string; color: string }> = {
  reviewing: { label: "Em análise", color: "var(--muted)" },
  planned: { label: "Planeada", color: "var(--stage-debate)" },
  in_progress: { label: "Em desenvolvimento", color: "var(--link)" },
  done: { label: "Feita", color: "var(--stage-approved)" },
  declined: { label: "Não vamos fazer", color: "var(--danger)" },
};
const ideaStatusOf = (value: string | null | undefined): IdeaStatus | null => IDEA_STATUSES.find((status) => status === value) ?? null;
export type ReportReason = "spam" | "insult" | "hate" | "personal_data" | "illegal" | "other";
export type ReportKind = "thread" | "post" | "comment";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam ou publicidade" },
  { value: "insult", label: "Insulto ou assédio" },
  { value: "hate", label: "Discurso de ódio" },
  { value: "personal_data", label: "Dados pessoais de alguém" },
  { value: "illegal", label: "Conteúdo ilegal" },
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
});

export function mapThreadSummary(thread: z.infer<typeof threadSummarySchema>): ThreadSummary {
  return { ...thread, ...ideaFields(thread), link: mapThreadLink(thread.link) };
}

export function mapThreadDetail(detail: z.infer<typeof threadDetailSchema>): ThreadDetail {
  return { ...detail, thread: { ...detail.thread, ...ideaFields(detail.thread), link: mapThreadLink(detail.thread.link) } };
}

/** "Zé (ID: Xk3_a9Qz)" or "Anónimo (ID: …)": nicknames are not unique, so the ID always goes with them. */
export const posterName = (nickname: string | null) => nickname?.trim() || "Anónimo";

export async function getBoards(): Promise<Board[]> {
  return (await request("/forums", z.object({ items: z.array(boardSchema) }), cached)).items;
}

export async function getThreads(
  board: string,
  { sort, page, limit, status }: { sort?: ThreadSort; page?: number; limit?: number; status?: IdeaStatus } = {},
): Promise<{ items: ThreadSummary[]; total: number }> {
  const result = await request(
    `/forums/${encodeURIComponent(board)}/threads${searchOf({ sort, page, limit, status })}`,
    z.object({ items: z.array(threadSummarySchema), total: z.number() }),
    { cache: "no-store" },
  );
  return { items: result.items.map(mapThreadSummary), total: result.total };
}

export async function getThread(id: number, { after }: { after?: number } = {}): Promise<ThreadDetail> {
  return mapThreadDetail(await request(`/forums/threads/${id}${searchOf({ after })}`, threadDetailSchema, { cache: "no-store" }));
}

export type NewThread = {
  title: string;
  body: string;
  nickname: string;
  articleId: number | null;
  initiativeId: number | null;
  captchaToken: string;
};
export type NewPost = { body: string; nickname: string; replyTo: number | null; captchaToken: string };

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
      recaptchaToken: input.captchaToken,
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
      recaptchaToken: input.captchaToken,
    }),
  );
}

/** An upvote on an idea; the API counts one per reader and answers with the new score. */
export async function voteThread(id: number): Promise<number> {
  return (await request(`/forums/threads/${id}/vote`, z.object({ score: z.number() }), { method: "POST" })).score;
}

export async function createReport(input: { kind: ReportKind; id: number; reason: ReportReason; details?: string }): Promise<void> {
  await request(
    "/reports",
    z.unknown(),
    post({ kind: input.kind, id: input.id, reason: input.reason, ...(input.details?.trim() ? { details: input.details.trim() } : {}) }),
  );
}

const FORUM_ERRORS: Record<string, string> = {
  recaptcha_failed: "A verificação anti-robô falhou. O teu texto foi mantido; confirma novamente e publica.",
  recaptcha_unavailable: "O fórum está temporariamente indisponível. O teu texto foi mantido; tenta daqui a pouco.",
  rate_limited: "Estás a publicar depressa demais. O teu texto foi mantido; espera um minuto e tenta novamente.",
  thread_locked: "Esta discussão foi fechada pela moderação e já não aceita respostas.",
  invalid_reply: "A mensagem a que estás a responder já não está nesta discussão.",
  not_found: "Esta discussão já não existe.",
};

/** A friendly message for a failed post, in Portuguese. */
export function forumErrorMessage(error: unknown): string {
  return (
    (error instanceof ApiError && error.code && FORUM_ERRORS[error.code]) ||
    "Não foi possível publicar. O teu texto foi mantido; tenta novamente."
  );
}

import { editorialPath } from "@/lib/editorial";
import { z } from "zod";
import type { IdeaStatusBody } from "@/lib/ideaAdmin";
import { ApiError } from "./client";

/*
 * The team's moderation area (backend docs: admin-api.md, forums-api.md "Moderation", feedback-api.md "Admin").
 * Browser only, through the site's own server at /api/v2/admin (see app/api/v2/admin/[...path]/route.ts),
 * so the API's httpOnly session cookie stays first-party. The page never sees the token.
 */

const BASE = "/api/v2/admin";

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

async function call<T>(path: string, schema: z.ZodType<T> | null, init?: { method?: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      credentials: "same-origin",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (cause) {
    throw new ApiError(`Network error on ${path}: ${String(cause)}`);
  }
  const json: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = errorSchema.safeParse(json);
    throw new ApiError(
      failure.success ? failure.data.error.message : `${response.status} on ${path}`,
      response.status,
      failure.success ? failure.data.error.code : null,
    );
  }
  if (!schema) return undefined as T;
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError(`Unexpected response from ${path}: ${parsed.error.message}`, response.status);
  return parsed.data;
}

const query = (values: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  return search.size > 0 ? `?${search}` : "";
};

/* Session and team */

export const ADMIN_ROLES = ["author", "moderator", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const ROLE_LABELS: Record<AdminRole, string> = { author: "Autor", moderator: "Moderador", admin: "Administrador" };
const roleSchema = z.enum(ADMIN_ROLES);

const meSchema = z.object({ admin: z.object({ id: z.number(), email: z.string(), name: z.string(), role: roleSchema }) });
export type Me = z.infer<typeof meSchema>["admin"];

/** Who is signed in, or null. */
export async function getMe(): Promise<Me | null> {
  try {
    return (await call("/me", meSchema)).admin;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export const login = (email: string, password: string) => call("/login", null, { method: "POST", body: { email, password } });
export const logout = () => call("/logout", null, { method: "POST" });
export const changePassword = (current: string, next: string) => call("/password", null, { method: "POST", body: { current, next } });

const teamMemberSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  disabled: z.boolean(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const getTeam = async () => (await call("/admins", z.object({ items: z.array(teamMemberSchema) }))).items;
export const inviteMember = (input: { email: string; name: string; role: AdminRole; password: string }) =>
  call("/admins", teamMemberSchema, { method: "POST", body: input });
export const updateMember = (id: number, input: { name?: string; role?: AdminRole; disabled?: boolean }) =>
  call(`/admins/${id}`, null, { method: "PATCH", body: input });

/** Who can do what: moderators moderate; only admins manage the team. */
export const canModerate = (me: Me) => me.role === "moderator" || me.role === "admin";

/* Reports */

export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "Spam ou publicidade",
  insult: "Insulto ou assédio",
  hate: "Ataque a um grupo",
  personal_data: "Dados pessoais",
  illegal: "Ilegal (difamação, crime…)",
  other: "Outro motivo",
  // News articles have their own reasons, about our tagging rather than what the outlet wrote.
  wrong_tags: "Partido ou pessoa errados",
  broken_link: "Link não funciona",
  duplicate: "Notícia repetida",
  not_politics: "Não é sobre política",
};
export type ReportKind = "thread" | "post" | "comment" | "article";

const reportSchema = z.object({
  kind: z.enum(["thread", "post", "comment", "article"]),
  targetId: z.number(),
  reports: z.number(),
  reasons: z.array(z.string()),
  details: z.array(z.string()).default([]),
  firstReportedAt: z.string(),
  resolution: z.string().nullable(),
  target: z
    .object({
      text: z.string().nullable(),
      hidden: z.boolean(),
      threadId: z.number().nullable().optional(),
      articleId: z.number().nullable().optional(),
      postId: z.number().nullable().optional(),
      storyId: z.number().nullish().catch(null),
    })
    .nullable(),
});
export type Report = z.infer<typeof reportSchema>;

export const getReports = async (status: "open" | "resolved") =>
  (await call(`/reports${query({ status, limit: 100 })}`, z.object({ items: z.array(reportSchema) }))).items;
export const resolveReport = (kind: ReportKind, targetId: number, action: "hide" | "dismiss") =>
  call("/reports/resolve", z.object({ resolved: z.number() }), { method: "POST", body: { kind, targetId, action } });

/* Comments */

const optionalId = z.number().nullish().catch(null);
const optionalTitle = z.string().nullish().catch(null);
/** On a news article, a story or an editorial post (admin-api.md): the other ids are null. */
const commentSchema = z.object({
  id: z.number(),
  articleId: optionalId,
  articleTitle: optionalTitle,
  storyId: optionalId,
  storyTitle: optionalTitle,
  postSlug: optionalTitle,
  postTitle: optionalTitle,
  parentId: z.number().nullable(),
  username: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  hiddenAt: z.string().nullable(),
});
export type AdminComment = z.infer<typeof commentSchema>;

/** Where a comment is on the site, and its name there; null when the API doesn't say. */
export function commentPlace(comment: AdminComment): { href: string; label: string } | null {
  if (comment.articleId)
    return { href: `/article/${comment.articleId}#comentarios`, label: comment.articleTitle ?? `Notícia #${comment.articleId}` };
  if (comment.storyId)
    return { href: `/historias/${comment.storyId}#comentarios`, label: comment.storyTitle ?? `História #${comment.storyId}` };
  if (comment.postSlug) return { href: `${editorialPath(comment.postSlug)}#comentarios`, label: comment.postTitle ?? "Artigo do blog" };
  return null;
}
export type CommentStatus = "visible" | "hidden" | "all";
export const COMMENTS_PAGE = 50;

export const getComments = async (status: CommentStatus, before?: number) =>
  (await call(`/comments${query({ status, before, limit: COMMENTS_PAGE })}`, z.object({ items: z.array(commentSchema) }))).items;
export const hideComment = (id: number, reason: string | null) =>
  call(`/comments/${id}/hide`, null, { method: "POST", body: reason ? { reason } : {} });
export const unhideComment = (id: number) => call(`/comments/${id}/unhide`, null, { method: "POST" });

/* Forum */

export type ThreadAction = "hide" | "unhide" | "lock" | "unlock" | "pin" | "unpin";
export const moderateThread = (id: number, action: ThreadAction) => call(`/forum/threads/${id}/${action}`, null, { method: "POST" });
export const moderatePost = (id: number, action: "hide" | "unhide") => call(`/forum/posts/${id}/${action}`, null, { method: "POST" });

/* Ideas board: the team's decision and replies signed «Politicando» (forums-api.md "The ideas board", admin-api.md). */

const ideaDecisionSchema = z.object({
  status: z.string().nullable(),
  answer: z.string().nullable(),
  answeredAt: z.string().nullable(),
  expectedOn: z.string().nullable(),
  duplicateOf: z.object({ id: z.number(), title: z.string() }).nullable().catch(null),
});
export type IdeaDecision = z.infer<typeof ideaDecisionSchema>;

export const setIdeaStatus = (id: number, body: IdeaStatusBody) =>
  call(`/forum/threads/${id}/status`, ideaDecisionSchema, { method: "PUT", body });
export const replyAsTeam = (threadId: number, body: string, replyTo: number | null) =>
  call(`/forum/threads/${threadId}/posts`, z.object({ id: z.number() }), {
    method: "POST",
    body: replyTo ? { body, replyTo } : { body },
  });

/* Audit log: here, for the threads hidden lately (a hidden thread leaves the public board, so this is how to find it again). */

const auditSchema = z.object({
  id: z.number(),
  admin: z.object({ id: z.number(), name: z.string() }).nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  at: z.string(),
});
export type AuditEntry = z.infer<typeof auditSchema>;

export const getAudit = async (entity: string, limit = 100) =>
  (await call(`/audit${query({ entity, limit })}`, z.object({ items: z.array(auditSchema) }))).items;

/* Feedback inbox */

export const FEEDBACK_KIND_LABELS: Record<string, string> = { error: "Erro", idea: "Ideia", broken: "Não funciona", other: "Outra coisa" };
export const FEEDBACK_STATUSES = ["open", "answered", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Por responder",
  answered: "Respondidas",
  closed: "Fechadas",
};

const correctionSchema = z.object({
  id: z.number(),
  status: z.string(),
  date: z.string(),
  area: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
});

const messageSchema = z.object({
  id: z.number(),
  kind: z.string(),
  message: z.string(),
  page: z.string().nullable(),
  url: z.string().nullable(),
  correction: z.string().nullable(),
  source: z.string().nullable(),
  email: z.string().nullable(),
  screenshot: z.string().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  reply: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  answeredAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  /** Sent while signed in: an answer on the site reaches their inbox. */
  account: z.boolean().catch(false),
  /** An answer on the site can reach the reader (their follow-up link, or their account). */
  followable: z.boolean().catch(false),
  corrections: z.array(correctionSchema).optional(),
});
export type FeedbackMessage = z.infer<typeof messageSchema>;

export const getMessages = async (status: FeedbackStatus | null) =>
  (await call(`/feedback${query({ status, limit: 200 })}`, z.object({ items: z.array(messageSchema) }))).items;
export const getMessage = (id: number) => call(`/feedback/${id}`, messageSchema);
/** The screenshot, through this site's server like everything else here. */
export const screenshotUrl = (id: number) => `${BASE}/feedback/${id}/screenshot`;
/** site: on the reader's follow-up link and inbox; email: emailed; none: only noted as answered (e.g. from your own email). */
export type AnswerChannel = "site" | "email" | "none";
export const answerMessage = (id: number, reply: string | null, channel: AnswerChannel) =>
  call(`/feedback/${id}/answer`, messageSchema, { method: "POST", body: { reply, channel } });
export const noteMessage = (id: number, note: string | null) =>
  call(`/feedback/${id}/note`, messageSchema, { method: "PUT", body: { note } });
export const closeMessage = (id: number) => call(`/feedback/${id}/close`, null, { method: "POST" });

export const CORRECTION_STATUSES = ["fixed", "checking", "rejected"] as const;
export const CORRECTION_STATUS_LABELS: Record<(typeof CORRECTION_STATUSES)[number], string> = {
  fixed: "Corrigido",
  checking: "A confirmar",
  rejected: "Não confirmado",
};
export const correctMessage = (
  id: number,
  input: { status: (typeof CORRECTION_STATUSES)[number]; title: string; url: string | null; area?: string; date?: string },
) => call(`/feedback/${id}/correction`, correctionSchema, { method: "POST", body: input });

/* Blog posts (editorial-api.md "Writing"): authors write and publish their own; moderators edit any and pick the featured ones. */

export const POST_KINDS = ["article", "opinion", "podcast", "interview", "video"] as const;
export type PostKind = (typeof POST_KINDS)[number];

const adminPostSummarySchema = z.object({
  id: z.number(),
  slug: z.string(),
  kind: z.enum(POST_KINDS),
  title: z.string(),
  subtitle: z.string().nullable(),
  authorName: z.string(),
  authorId: z.number().nullable(),
  coverImageUrl: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  tags: z.array(z.string()),
  featured: z.boolean(),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});
const adminPostSchema = adminPostSummarySchema.extend({ body: z.string() });
export type AdminPostSummary = z.infer<typeof adminPostSummarySchema>;
export type AdminPost = z.infer<typeof adminPostSchema>;

/** What the editor sends on create and save: the API replaces every field. */
export type PostInput = {
  title: string;
  subtitle: string | null;
  slug: string | null;
  kind: PostKind;
  body: string;
  authorName: string | null;
  coverImageUrl: string | null;
  mediaUrl: string | null;
  tags: string[];
};

export const getPosts = async () => (await call("/editorial", z.object({ items: z.array(adminPostSummarySchema) }))).items;
export const getPost = (id: number) => call(`/editorial/${id}`, adminPostSchema);
export const createPost = (input: PostInput) => call("/editorial", adminPostSchema, { method: "POST", body: input });
export const savePost = (id: number, input: PostInput) => call(`/editorial/${id}`, adminPostSchema, { method: "PUT", body: input });
export type PostAction = "publish" | "unpublish" | "feature" | "unfeature";
export const changePost = (id: number, action: PostAction) => call(`/editorial/${id}/${action}`, adminPostSchema, { method: "POST" });
export const deletePost = (id: number) => call(`/editorial/${id}`, null, { method: "DELETE" });

/** Who may change a post: its author, or any moderator. */
export const canEditPost = (me: Me, post: Pick<AdminPostSummary, "authorId">) => canModerate(me) || post.authorId === me.id;

/** The API's error codes, in words for the team. */
export function adminErrorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : null;
  switch (code) {
    case "invalid_credentials":
      return "Email ou palavra-passe errados.";
    case "rate_limited":
      return "Demasiadas tentativas. Espera um minuto.";
    case "forbidden":
      return "A tua função não permite fazer isto.";
    case "unauthenticated":
      return "A sessão terminou. Entra outra vez.";
    case "email_taken":
      return "Já há alguém da equipa com esse email.";
    case "self_lockout":
      return "Não podes desativar-te nem tirar-te a função de administrador.";
    case "no_email":
      return "Esta pessoa não deixou email (ou foi apagado ao fechar).";
    case "not_an_idea":
      return "Esta discussão não é do quadro de ideias.";
    case "duplicate_of_required":
      return "Escreve o número da ideia original.";
    case "invalid_duplicate":
      return "Esse número não é de outra ideia visível, ou essa ideia também é duplicada.";
    case "not_followable":
      return "Esta mensagem foi fechada e não veio de uma conta: já ninguém a pode ler no site.";
    case "empty_reply":
      return "Escreve a resposta antes de a enviar.";
    case "mail_unavailable":
      return "O envio de email ainda não está configurado no servidor. Responde do teu email e marca como respondida.";
    case "slug_taken":
      return "Já há outro artigo com esse endereço. Escolhe outro, ou deixa em branco para o fazer a partir do título.";
    case "unsupported_media":
      return "O link do áudio ou vídeo tem de ser do YouTube, Vimeo, Spotify, SoundCloud ou Apple Podcasts.";
    case "empty_body":
      return "Escreve o texto antes de publicar.";
    case "not_published":
      return "Publica o artigo antes de o pôr em destaque.";
    case "published":
      return "Despublica o artigo antes de o apagar.";
    case "payload_too_large":
      return "É demasiado grande para enviar (um artigo pode ter até 100 000 caracteres). Encurta-o e tenta outra vez.";
    case "validation_failed":
      return error instanceof ApiError ? `Falta ou está mal um campo: ${error.message}` : "Falta ou está mal um campo.";
    default:
      return "Não foi possível. Tenta outra vez.";
  }
}

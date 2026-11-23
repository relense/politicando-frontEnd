import { isSitePath } from "./mappers";
import { z } from "zod";
import { ApiError, request } from "./client";

/*
 * Readers' accounts (backend docs/accounts-api.md): a public username and a password, and an optional private email that,
 * once confirmed, recovers the password and can carry the weekly newsletter. Browser only: every
 * call goes through the site's own server (request() sends /auth and /me there), so the httpOnly session cookie,
 * politicando_session, is first-party and the page never sees it.
 */

const flag = z
  .boolean()
  .optional()
  .catch(false)
  .transform((value) => value ?? false);
/** The account's newsletter: none, waiting for the email's confirmation, or receiving it. Null when the API doesn't say. */
const newsletterState = z
  .enum(["none", "pending", "confirmed"])
  .nullable()
  .optional()
  .catch(null)
  .transform((value) => value ?? null);

export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  createdAt: z.string(),
  /** Private: only the reader sees it. */
  email: z
    .string()
    .nullable()
    .optional()
    .catch(null)
    .transform((value) => value ?? null),
  emailConfirmed: flag,
  /** No confirmed email and "Agora não" not pressed in the last 30 days: the feed may ask for one. */
  askForEmail: flag,
  newsletter: newsletterState,
});
export type Reader = z.infer<typeof userSchema>;

const ids = z.array(z.number()).catch([]);
const strings = z.array(z.string()).catch([]);

export const accountStateSchema = z.object({
  saved: z
    .object({ articles: ids, stories: ids, editorial: ids, comments: ids, threads: ids, replies: ids })
    .catch({ articles: [], stories: [], editorial: [], comments: [], threads: [], replies: [] }),
  /** Stories, forum threads and Budget proposals the reader follows (backend docs/engagement-api.md). */
  follows: z.object({ stories: ids, threads: ids, budgetProposals: ids }).catch({ stories: [], threads: [], budgetProposals: [] }),
  hidden: ids,
  muted: z.object({ sources: strings, parties: strings }).catch({ sources: [], parties: [] }),
  read: ids,
  votes: z
    .object({
      articles: z.record(z.string(), z.number()).catch({}),
      editorial: z.record(z.string(), z.number()).catch({}),
      stories: ids,
      comments: ids,
      forum: ids,
      /** Replies the reader voted for (ideas board). */
      forumPosts: ids,
    })
    .catch({ articles: {}, editorial: {}, stories: [], comments: [], forum: [], forumPosts: [] }),
});
export type AccountState = z.infer<typeof accountStateSchema>;
/** What the browser had before logging in (lists newest first). Votes aren't merged: they were already counted. */
export type MergeInput = { saved: Pick<AccountState["saved"], "articles" | "stories"> } & Pick<AccountState, "hidden" | "muted" | "read">;

const json = (method: string, body?: unknown) => ({
  method,
  cache: "no-store" as const,
  headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** Who is logged in, or null. */
export async function getReader(): Promise<Reader | null> {
  try {
    return await request("/me", userSchema, { cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

const userAnswer = z.object({ user: userSchema });
export type Credentials = { username: string; password: string; captchaToken: string };
const credentials = ({ username, password, captchaToken }: Credentials) => ({ username, password, recaptchaToken: captchaToken });

/** A sign-up's answer: with an email, whether the confirmation went out and, with the box ticked, the newsletter pending. */
export const registerAnswerSchema = z.object({
  user: userSchema,
  emailSent: flag,
  newsletter: z
    .literal("pending")
    .optional()
    .catch(undefined)
    .transform((value) => value ?? null),
});
export type SignUp = Credentials & { email?: string; newsletter?: boolean };
export const register = ({ email, newsletter, ...input }: SignUp) =>
  request(
    "/auth/register",
    registerAnswerSchema,
    json("POST", { ...credentials(input), ...(email ? { email, newsletter: Boolean(newsletter) } : {}) }),
  );
export const logIn = async (input: Credentials) => (await request("/auth/login", userAnswer, json("POST", credentials(input)))).user;
export const logOut = () => request("/auth/logout", z.unknown(), json("POST"));

export const getAccountState = () => request("/me/state", accountStateSchema, { cache: "no-store" });
export const mergeAccountState = (input: MergeInput) => request("/me/merge", accountStateSchema, json("POST", input));

export const changeReaderPassword = (current: string, next: string) =>
  request("/me/password", z.unknown(), json("PUT", { current, new: next }));
export const deleteReader = (password: string) => request("/me", z.unknown(), json("DELETE", { password }));

// ── The email ──────────────────────────────────────────────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** What's wrong with a typed address, or null (an empty one is fine: the email is optional). The API checks it again. */
export const emailProblem = (value: string) =>
  !value.trim() || EMAIL.test(value.trim()) ? null : "Esse email não parece certo. Confirma-o.";

/** The «Confirmar» button on /conta/confirmar-email: only on the press, never on load (mail scanners open every link). */
export const confirmEmail = (token: string) =>
  request("/auth/email/confirm", z.object({ status: z.string(), newsletter: z.boolean().catch(false) }), json("POST", { token }));
/** Add or change the email; a confirmation link is emailed. */
export const setEmail = (email: string, newsletter?: boolean) =>
  request(
    "/me/email",
    z.object({ user: userSchema, emailSent: flag }),
    json("PUT", { email, ...(newsletter === undefined ? {} : { newsletter }) }),
  );
export const removeEmail = () => request("/me/email", z.unknown(), json("DELETE"));
/** «Agora não»: the API stops asking for 30 days. */
export const remindLater = () => request("/me/email/remind-later", z.unknown(), json("POST"));

/** Always 202, whether or not the address is on an account. */
export const forgotPassword = (email: string, captchaToken: string) =>
  request("/auth/password/forgot", z.unknown(), json("POST", { email, recaptchaToken: captchaToken }));
/** The new password from the emailed link: logs this browser in. */
export const resetPassword = async (token: string, password: string) =>
  (await request("/auth/password/reset", userAnswer, json("POST", { token, password }))).user;

/**
 * The weekly newsletter for the account's email. On: "confirmed", or "pending" until the email is confirmed (one
 * confirmation does both); 409 `no_email` without one. Off: "none".
 */
export async function setNewsletter(on: boolean): Promise<"none" | "pending" | "confirmed"> {
  if (!on) {
    await request("/me/newsletter", z.unknown(), json("DELETE"));
    return "none";
  }
  const answer = await request(
    "/me/newsletter",
    z.object({ newsletter: z.enum(["none", "pending", "confirmed"]), emailSent: flag }),
    json("PUT"),
  );
  return answer.newsletter;
}

const when = z.string();
export const activitySchema = z.object({
  comments: z
    .array(
      z.object({
        id: z.number(),
        body: z.string(),
        articleId: z.number().nullable(),
        storyId: z.number().nullable(),
        postId: z.number().nullable(),
        likes: z.number(),
        createdAt: when,
      }),
    )
    .catch([]),
  threads: z.array(z.object({ id: z.number(), board: z.string(), title: z.string(), body: z.string(), createdAt: when })).catch([]),
  posts: z.array(z.object({ id: z.number(), threadId: z.number(), body: z.string(), createdAt: when })).catch([]),
});
export type Activity = z.infer<typeof activitySchema>;
export const getActivity = () => request("/me/activity", activitySchema, { cache: "no-store" });
/** The GDPR download, through the site's server like everything else here. */
export const EXPORT_URL = "/api/v2/me/export";

/* One call per change, each idempotent (204). */
export type ListChange =
  | { list: "saved"; kind: "article" | "story"; id: number }
  | { list: "hidden"; id: number }
  | { list: "muted"; kind: "source" | "party"; value: string }
  | { list: "read"; id: number };

export function changeList(change: ListChange, on: boolean) {
  const path =
    change.list === "saved"
      ? `/me/saved/${change.kind}/${change.id}`
      : change.list === "hidden"
        ? `/me/hidden/${change.id}`
        : change.list === "muted"
          ? `/me/muted/${change.kind}/${encodeURIComponent(change.value)}`
          : `/me/read/${change.id}`;
  return request(path, z.unknown(), json(on ? "PUT" : "DELETE"));
}

/** The API's error codes, in words for readers. */
export function accountErrorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : null;
  switch (code) {
    case "invalid_credentials":
      return "Nome ou palavra-passe errados.";
    case "username_taken":
      return "Esse nome já está a ser usado. Escolhe outro.";
    case "too_many_attempts":
      return "Demasiadas tentativas com este nome. Espera um quarto de hora e tenta outra vez.";
    case "rate_limited":
      return "Demasiadas tentativas. Espera um minuto.";
    case "recaptcha_failed":
      return "A verificação anti-robô falhou. Confirma outra vez.";
    case "recaptcha_unavailable":
      return "As contas estão temporariamente indisponíveis. Tenta daqui a pouco.";
    case "personal_data":
    case "hate":
    case "threat":
      return error instanceof ApiError && error.message ? error.message : "Esse nome não pode ser usado. Escolhe outro.";
    case "unauthenticated":
      return "A sessão terminou. Entra outra vez.";
    case "invalid_email":
      return "Esse email não parece certo. Confirma-o.";
    case "invalid_token":
      return "Esta ligação já não é válida: expirou ou já foi usada.";
    case "email_taken":
      return "Esse email já está confirmado noutra conta.";
    case "mail_unavailable":
      return "Não conseguimos enviar emails neste momento. Tenta daqui a pouco.";
    default:
      if (error instanceof ApiError && error.status === 400)
        return "Confirma os campos: o nome tem 3 a 20 letras, números ou _, e a palavra-passe pelo menos 8 caracteres.";
      return "Não foi possível. Tenta outra vez.";
  }
}

/** Only paths on this site, so a link can't send someone elsewhere after logging in. */
export const safeReturn = (value: string | undefined) => (isSitePath(value) ? value : "/");

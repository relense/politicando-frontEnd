import { z } from "zod";
import { ApiError, request } from "./client";

/*
 * Readers' accounts (backend docs/accounts-api.md): a public username and a password, no email. Browser only: every
 * call goes through the site's own server (request() sends /auth and /me there), so the httpOnly session cookie,
 * politicando_session, is first-party and the page never sees it.
 */

export const userSchema = z.object({ id: z.number(), username: z.string(), createdAt: z.string() });
export type Reader = z.infer<typeof userSchema>;

const ids = z.array(z.number()).catch([]);
const strings = z.array(z.string()).catch([]);

export const accountStateSchema = z.object({
  saved: z
    .object({ articles: ids, stories: ids, editorial: ids, comments: ids, threads: ids, replies: ids })
    .catch({ articles: [], stories: [], editorial: [], comments: [], threads: [], replies: [] }),
  /** Stories and forum threads the reader follows (backend docs/engagement-api.md). */
  follows: z.object({ stories: ids, threads: ids }).catch({ stories: [], threads: [] }),
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
    })
    .catch({ articles: {}, editorial: {}, stories: [], comments: [], forum: [] }),
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

export const register = async (input: Credentials) => (await request("/auth/register", userAnswer, json("POST", credentials(input)))).user;
export const logIn = async (input: Credentials) => (await request("/auth/login", userAnswer, json("POST", credentials(input)))).user;
export const logOut = () => request("/auth/logout", z.unknown(), json("POST"));

export const getAccountState = () => request("/me/state", accountStateSchema, { cache: "no-store" });
export const mergeAccountState = (input: MergeInput) => request("/me/merge", accountStateSchema, json("POST", input));

export const changeReaderPassword = (current: string, next: string) =>
  request("/me/password", z.unknown(), json("PUT", { current, new: next }));
export const deleteReader = (password: string) => request("/me", z.unknown(), json("DELETE", { password }));

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
    default:
      if (error instanceof ApiError && error.status === 400)
        return "Confirma os campos: o nome tem 3 a 20 letras, números ou _, e a palavra-passe pelo menos 8 caracteres.";
      return "Não foi possível. Tenta outra vez.";
  }
}

/** Only paths on this site, so a link can't send someone elsewhere after logging in. */
export const safeReturn = (value: string | undefined) =>
  value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";

import { http, HttpResponse } from "msw";

/*
 * Readers' accounts (backend docs/accounts-api.md), for the mock API: fictional usernames, test-only passwords,
 * everything in memory. `POST /__mock/login-required` switches the API's gate (LOGIN_REQUIRED) on or off for tests.
 */

const API = "*/api/v2";
export const READER_COOKIE = "politicando_session";

export type MockReader = {
  id: number;
  username: string;
  password: string;
  createdAt: string;
  saved: { articles: number[]; stories: number[]; editorial: number[]; comments: number[]; threads: number[]; replies: number[] };
  follows: { stories: number[]; threads: number[] };
  hidden: number[];
  muted: { sources: string[]; parties: string[] };
  read: number[];
  email?: string | null;
  emailConfirmed?: boolean;
  /** "Agora não" until then (ms). */
  remindAfter?: number;
  newsletter?: "none" | "pending" | "confirmed";
};

const readers: MockReader[] = [
  {
    id: 1,
    username: "leitora_de_teste",
    password: "palavra-passe-de-teste",
    createdAt: "2026-11-10T10:00:00.000Z",
    saved: { articles: [101], stories: [], editorial: [], comments: [], threads: [], replies: [] },
    follows: { stories: [], threads: [] },
    hidden: [],
    muted: { sources: [], parties: [] },
    read: [],
  },
];
const sessions = new Map<string, number>();
let nextId = 2;

/** The API's gate: off by default, as in production until the site is ready. */
export const gate = { loginRequired: false };

const fail = (status: number, code: string, message = code) => HttpResponse.json({ error: { code, message } }, { status });
const noContent = (headers?: Record<string, string>) => new HttpResponse(null, { status: 204, headers });
const cookie = (token: string, maxAge: number) => `${READER_COOKIE}=${token}; Path=/api/v2; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;

/** The logged-in reader, from the session cookie; null without one. */
export function readerOf(request: Request): MockReader | null {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === READER_COOKIE)?.[1];
  return readers.find((reader) => reader.id === (token ? sessions.get(token) : undefined)) ?? null;
}

/** For writes: the 401 the API sends when the gate is on and no one is logged in, or null to go ahead. */
export const gateRefusal = (request: Request) =>
  gate.loginRequired && !readerOf(request) ? fail(401, "login_required", "Log in to take part") : null;

const publicReader = ({
  id,
  username,
  createdAt,
  email = null,
  emailConfirmed = false,
  remindAfter = 0,
  newsletter = "none",
}: MockReader) => ({
  id,
  username,
  createdAt,
  email,
  emailConfirmed,
  askForEmail: !emailConfirmed && remindAfter <= Date.now(),
  newsletter,
});

/*
 * The emails the API would send, kept for tests: GET /__mock/last-email?to=… gives the newest link's token. Tokens
 * containing "expirado" are refused as expired.
 */
type MockMail = { to: string; kind: "confirm" | "reset"; token: string; readerId: number; email: string; newsletter: boolean };
const mails: MockMail[] = [];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const send = (mail: Omit<MockMail, "token">) => {
  const token = `${mail.kind}-${Math.random().toString(36).slice(2)}`;
  mails.push({ ...mail, token });
  return token;
};
const emailTaken = (email: string, except: number) =>
  readers.some((reader) => reader.id !== except && reader.emailConfirmed && reader.email?.toLowerCase() === email.toLowerCase());

/** Each reader's votes on news and marks on blog posts, as /me/state lists them (0 takes one back). */
const readerVotes = new Map<number, { articles: Record<string, number>; editorial: Record<string, number> }>();
export function recordVote(request: Request, kind: "articles" | "editorial", key: string | number, value: number) {
  const reader = readerOf(request);
  if (!reader) return;
  const votes = readerVotes.get(reader.id) ?? { articles: {}, editorial: {} };
  if (value === 0) delete votes[kind][String(key)];
  else votes[kind][String(key)] = value;
  readerVotes.set(reader.id, votes);
}

/** Each reader's comment likes and forum votes, as /me/state lists them: their own on what they post included. */
type VoteList = "comments" | "forum" | "forumPosts";
const readerLists = new Map<number, Record<VoteList, number[]>>();
export function recordListVote(request: Request, kind: VoteList, id: number, on: boolean) {
  const reader = readerOf(request);
  if (!reader) return;
  const lists = readerLists.get(reader.id) ?? { comments: [], forum: [], forumPosts: [] };
  lists[kind] = [id, ...lists[kind].filter((item) => item !== id)].filter((item) => on || item !== id);
  readerLists.set(reader.id, lists);
}

const stateOf = (reader: MockReader) => ({
  saved: reader.saved,
  follows: reader.follows,
  hidden: reader.hidden,
  muted: reader.muted,
  read: reader.read,
  votes: {
    articles: {},
    editorial: {},
    ...readerVotes.get(reader.id),
    stories: [],
    comments: [],
    forum: [],
    forumPosts: [],
    ...readerLists.get(reader.id),
  },
});

const signIn = (reader: MockReader, status = 200) => {
  const token = `leitor-${reader.id}-${Math.random().toString(36).slice(2)}`;
  sessions.set(token, reader.id);
  return HttpResponse.json({ user: publicReader(reader) }, { status, headers: { "Set-Cookie": cookie(token, 2592000) } });
};

type Body = { username?: unknown; password?: unknown; recaptchaToken?: unknown; email?: unknown; newsletter?: unknown };
const newestFirst = <T>(added: T[], existing: T[]) => [...new Set([...added, ...existing])];

const withReader =
  (
    handle: (
      reader: MockReader,
      request: Request,
      params: Record<string, string | readonly string[] | undefined>,
    ) => Response | Promise<Response>,
  ) =>
  ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    const reader = readerOf(request);
    return reader ? handle(reader, request, params) : fail(401, "unauthenticated", "Log in first");
  };

export const accountHandlers = [
  http.post(`${API}/__mock/login-required`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { on?: boolean };
    gate.loginRequired = Boolean(body.on);
    return HttpResponse.json(gate);
  }),
  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Body;
    if (typeof body.recaptchaToken !== "string" || !body.recaptchaToken) return fail(403, "recaptcha_failed");
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || password.length < 8) return fail(400, "validation_failed", "body/username: Invalid");
    if (
      ["admin", "politicando", "moderador"].includes(username.toLowerCase()) ||
      readers.some((reader) => reader.username.toLowerCase() === username.toLowerCase())
    )
      return fail(409, "username_taken", "That username is taken");
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const newsletter = body.newsletter === true;
    if ((email && !EMAIL.test(email)) || (newsletter && !email)) return fail(400, "invalid_email", "That is not a valid email address");
    const reader: MockReader = {
      id: nextId++,
      username,
      password,
      createdAt: new Date().toISOString(),
      saved: { articles: [], stories: [], editorial: [], comments: [], threads: [], replies: [] },
      follows: { stories: [], threads: [] },
      hidden: [],
      muted: { sources: [], parties: [] },
      read: [],
      email: email || null,
      newsletter: newsletter ? "pending" : "none",
    };
    readers.push(reader);
    if (!email) return signIn(reader, 201);
    send({ to: email, kind: "confirm", readerId: reader.id, email, newsletter });
    const answer = signIn(reader, 201);
    const user = ((await answer.json()) as { user: unknown }).user;
    return HttpResponse.json(
      { user, emailSent: true, ...(newsletter ? { newsletter: "pending" } : {}) },
      { status: 201, headers: answer.headers },
    );
  }),
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Body;
    if (typeof body.recaptchaToken !== "string" || !body.recaptchaToken) return fail(403, "recaptcha_failed");
    const reader = readers.find((item) => typeof body.username === "string" && item.username.toLowerCase() === body.username.toLowerCase());
    if (!reader || reader.password !== body.password) return fail(401, "invalid_credentials", "Wrong username or password");
    return signIn(reader);
  }),
  http.post(`${API}/auth/logout`, ({ request }) => {
    const token = request.headers.get("cookie")?.match(new RegExp(`${READER_COOKIE}=([^;]+)`))?.[1];
    if (token) sessions.delete(token);
    return noContent({ "Set-Cookie": cookie("", 0) });
  }),
  http.get(
    `${API}/me`,
    withReader((reader) => HttpResponse.json(publicReader(reader))),
  ),
  http.get(`${API}/__mock/last-email`, ({ request }) => {
    const to = new URL(request.url).searchParams.get("to")?.toLowerCase();
    const mail = mails.findLast((item) => item.to.toLowerCase() === to);
    return mail ? HttpResponse.json({ kind: mail.kind, token: mail.token }) : fail(404, "not_found");
  }),
  http.post(`${API}/auth/email/confirm`, async ({ request }) => {
    const { token } = (await request.json().catch(() => ({}))) as { token?: string };
    const mail = mails.find((item) => item.kind === "confirm" && item.token === token);
    const reader = readers.find((item) => item.id === mail?.readerId);
    if (!mail || !reader || reader.email !== mail.email || token?.includes("expirado"))
      return fail(400, "invalid_token", "This link is no longer valid");
    if (emailTaken(mail.email, reader.id)) return fail(409, "email_taken", "Another account confirmed this email");
    reader.emailConfirmed = true;
    // One confirmation does both: the newsletter asked for with this email, or switched on while it waited.
    const newsletter = mail.newsletter || reader.newsletter === "pending";
    if (newsletter) reader.newsletter = "confirmed";
    return HttpResponse.json({ status: "confirmed", newsletter });
  }),
  http.put(
    `${API}/me/email`,
    withReader(async (reader, request) => {
      const body = (await request.json().catch(() => ({}))) as { email?: unknown; newsletter?: unknown };
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!EMAIL.test(email)) return fail(400, "invalid_email", "That is not a valid email address");
      // true: subscribe once confirmed; false: don't; left out ("Reenviar"): the earlier choice for the same address, off for a new one.
      const same = reader.email?.toLowerCase() === email.toLowerCase();
      const newsletter = body.newsletter === true || (body.newsletter === undefined && same && reader.newsletter !== "none");
      reader.email = email;
      reader.emailConfirmed = false;
      reader.newsletter = newsletter ? "pending" : "none";
      send({ to: email, kind: "confirm", readerId: reader.id, email, newsletter });
      return HttpResponse.json({ user: publicReader(reader), emailSent: true });
    }),
  ),
  http.delete(
    `${API}/me/email`,
    withReader((reader) => {
      reader.email = null;
      reader.emailConfirmed = false;
      reader.newsletter = "none";
      return noContent();
    }),
  ),
  http.post(
    `${API}/me/email/remind-later`,
    withReader((reader) => {
      reader.remindAfter = Date.now() + 30 * 86_400_000;
      return noContent();
    }),
  ),
  // The account's newsletter (accounts-api.md): pending until the email is confirmed; 409 no_email without one.
  http.put(
    `${API}/me/newsletter`,
    withReader((reader) => {
      if (!reader.email) return fail(409, "no_email", "Add an email first");
      reader.newsletter = reader.emailConfirmed ? "confirmed" : "pending";
      if (!reader.emailConfirmed) send({ to: reader.email, kind: "confirm", readerId: reader.id, email: reader.email, newsletter: true });
      return HttpResponse.json({ newsletter: reader.newsletter, emailSent: !reader.emailConfirmed });
    }),
  ),
  http.delete(
    `${API}/me/newsletter`,
    withReader((reader) => {
      reader.newsletter = "none";
      return noContent();
    }),
  ),
  http.post(`${API}/auth/password/forgot`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; recaptchaToken?: string };
    if (!body.recaptchaToken) return fail(403, "recaptcha_failed");
    const reader = readers.find((item) => item.emailConfirmed && item.email?.toLowerCase() === body.email?.trim().toLowerCase());
    if (reader?.email) send({ to: reader.email, kind: "reset", readerId: reader.id, email: reader.email, newsletter: false });
    return HttpResponse.json({ status: "sent" }, { status: 202 });
  }),
  http.post(`${API}/auth/password/reset`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
    const index = mails.findIndex((item) => item.kind === "reset" && item.token === body.token);
    const reader = readers.find((item) => item.id === mails[index]?.readerId);
    if (index < 0 || !reader || body.token?.includes("expirado")) return fail(400, "invalid_token", "This link is no longer valid");
    if (!body.password || body.password.length < 8) return fail(400, "validation_failed", "body/password: Too small");
    mails.splice(index, 1);
    reader.password = body.password;
    for (const [token, id] of sessions) if (id === reader.id) sessions.delete(token);
    return signIn(reader);
  }),
  http.get(
    `${API}/me/state`,
    withReader((reader) => HttpResponse.json(stateOf(reader))),
  ),
  http.post(
    `${API}/me/merge`,
    withReader(async (reader, request) => {
      const body = (await request.json().catch(() => ({}))) as Partial<ReturnType<typeof stateOf>>;
      reader.saved = {
        ...reader.saved,
        articles: newestFirst(body.saved?.articles ?? [], reader.saved.articles),
        stories: newestFirst(body.saved?.stories ?? [], reader.saved.stories),
      };
      reader.hidden = newestFirst(body.hidden ?? [], reader.hidden);
      reader.muted = {
        sources: newestFirst(body.muted?.sources ?? [], reader.muted.sources),
        parties: newestFirst(body.muted?.parties ?? [], reader.muted.parties),
      };
      reader.read = newestFirst(body.read ?? [], reader.read);
      return HttpResponse.json(stateOf(reader));
    }),
  ),
  ...(["put", "delete"] as const).flatMap((method) => [
    http[method](
      `${API}/me/saved/:kind/:id`,
      withReader((reader, _request, params) => {
        const LISTS = {
          article: "articles",
          story: "stories",
          editorial: "editorial",
          comment: "comments",
          thread: "threads",
          reply: "replies",
        } as const;
        const list = LISTS[params.kind as keyof typeof LISTS];
        if (!list) return fail(404, "not_found");
        const id = Number(params.id);
        reader.saved[list] = method === "put" ? newestFirst([id], reader.saved[list]) : reader.saved[list].filter((item) => item !== id);
        return noContent();
      }),
    ),
    http[method](
      `${API}/me/hidden/:id`,
      withReader((reader, _request, params) => {
        const id = Number(params.id);
        reader.hidden = method === "put" ? newestFirst([id], reader.hidden) : reader.hidden.filter((item) => item !== id);
        return noContent();
      }),
    ),
    http[method](
      `${API}/me/muted/:kind/:value`,
      withReader((reader, _request, params) => {
        const list = params.kind === "party" ? "parties" : "sources";
        const value = String(params.value);
        reader.muted[list] =
          method === "put" ? newestFirst([value], reader.muted[list]) : reader.muted[list].filter((item) => item !== value);
        return noContent();
      }),
    ),
  ]),
  http.put(
    `${API}/me/read/:id`,
    withReader((reader, _request, params) => {
      reader.read = newestFirst([Number(params.id)], reader.read).slice(0, 200);
      return noContent();
    }),
  ),
  http.put(
    `${API}/me/password`,
    withReader(async (reader, request) => {
      const body = (await request.json().catch(() => ({}))) as { current?: string; new?: string };
      if (body.current !== reader.password) return fail(401, "invalid_credentials", "Wrong password");
      if (!body.new || body.new.length < 8) return fail(400, "validation_failed", "body/new: Too small");
      reader.password = body.new;
      return noContent();
    }),
  ),
  http.get(
    `${API}/me/activity`,
    withReader(() =>
      HttpResponse.json({
        comments: [
          {
            id: 9100,
            body: "Um comentário de teste feito com conta.",
            articleId: 100,
            storyId: null,
            postId: null,
            likes: 2,
            createdAt: "2026-11-15T10:00:00.000Z",
            hiddenAt: null,
          },
        ],
        threads: [],
        posts: [],
      }),
    ),
  ),
  http.get(
    `${API}/me/export`,
    withReader(
      (reader) =>
        new HttpResponse(JSON.stringify({ user: publicReader(reader), state: stateOf(reader) }), {
          headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="politicando.json"' },
        }),
    ),
  ),
  http.delete(
    `${API}/me`,
    withReader(async (reader, request) => {
      const body = (await request.json().catch(() => ({}))) as { password?: string };
      if (body.password !== reader.password) return fail(401, "invalid_credentials", "Wrong password");
      readers.splice(readers.indexOf(reader), 1);
      for (const [token, id] of sessions) if (id === reader.id) sessions.delete(token);
      return noContent({ "Set-Cookie": cookie("", 0) });
    }),
  ),
];

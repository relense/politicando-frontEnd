import { http, HttpResponse } from "msw";
import { adminFail, audit, auditLog, COOKIE, requireAdmin, sessions, team, type MockAdmin } from "./adminState";

const API = "*/api/v2";

const publicAdmin = ({ id, email, name, role }: MockAdmin) => ({ id, email, name, role });
const member = ({ id, email, name, role, disabled, createdAt, lastLoginAt }: MockAdmin) => ({
  id,
  email,
  name,
  role,
  disabled,
  createdAt,
  lastLoginAt,
});
const noContent = () => new HttpResponse(null, { status: 204 });

/** Fictional messages to the team (feedback-api.md "Admin"). */
type MockMessage = {
  id: number;
  kind: "error" | "idea" | "broken" | "other";
  message: string;
  page: string | null;
  url: string | null;
  correction: string | null;
  source: string | null;
  email: string | null;
  screenshot: boolean;
  status: "open" | "answered" | "closed";
  reply: string | null;
  note: string | null;
  createdAt: string;
  answeredAt: string | null;
  closedAt: string | null;
  corrections: { id: number; status: string; date: string; area: string | null; title: string; url: string | null }[];
  /** Sent signed in: the reader's id (never sent to the page). */
  readerId?: number | null;
  /** The private follow-up token; gone once closed. */
  token?: string | null;
};

const messages: MockMessage[] = [
  {
    id: 41,
    token: "segue-41",
    kind: "error",
    message: "O deputado Duarte Mesquita aparece no partido errado na página dos deputados.",
    page: "Deputados",
    url: "https://politicando.pt/deputados",
    correction: "É do partido Exemplo desde 2025.",
    source: "https://www.parlamento.pt",
    email: "leitora@exemplo.pt",
    screenshot: true,
    status: "open",
    reply: null,
    note: null,
    createdAt: "2026-11-15T18:20:00.000Z",
    answeredAt: null,
    closedAt: null,
    corrections: [],
  },
  {
    id: 40,
    token: "segue-40",
    kind: "broken",
    message: "O mapa das eleições não abre no meu telemóvel.",
    page: "Eleições",
    url: null,
    correction: null,
    source: null,
    email: null,
    screenshot: false,
    status: "open",
    reply: null,
    note: null,
    createdAt: "2026-11-14T08:05:00.000Z",
    answeredAt: null,
    closedAt: null,
    corrections: [],
  },
  {
    id: 39,
    token: "segue-39",
    kind: "other",
    message: "Parabéns pelo site!",
    page: null,
    url: null,
    correction: null,
    source: null,
    email: "leitor@exemplo.pt",
    screenshot: false,
    status: "answered",
    reply: "Obrigado!",
    note: null,
    createdAt: "2026-11-10T12:00:00.000Z",
    answeredAt: "2026-11-11T09:00:00.000Z",
    closedAt: null,
    corrections: [],
  },
];
let nextCorrectionId = 100;

const present = ({ readerId, token, ...message }: MockMessage) => ({
  ...message,
  screenshot: message.screenshot ? `/api/v2/admin/feedback/${message.id}/screenshot` : null,
  account: Boolean(readerId),
  followable: Boolean(token) || Boolean(readerId),
});

/** The inbox lives in engagementFixtures; it hands over how to tell a reader. */
let notifyReader: (readerId: number, feedback: { id: number; reply: string | null }) => void = () => {};
export const registerFeedbackNotifier = (notify: typeof notifyReader) => {
  notifyReader = notify;
};

let nextMessageId = 200;
/** A message from the public form (feedbackFixtures), signed in or not; its private follow-up token. */
export function addMessage(
  fields: Pick<MockMessage, "kind" | "message" | "page" | "url" | "correction" | "source" | "email">,
  readerId: number | null,
) {
  const id = nextMessageId++;
  const token = `segue-${id}-${Math.random().toString(36).slice(2, 10)}`;
  messages.unshift({
    id,
    ...fields,
    screenshot: false,
    status: "open",
    reply: null,
    note: null,
    createdAt: new Date().toISOString(),
    answeredAt: null,
    closedAt: null,
    corrections: [],
    readerId,
    token,
  });
  return { id, followUpToken: token };
}

// A 1×1 grey PNG: enough for the page to show "a screenshot".
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg=="), (char) =>
  char.charCodeAt(0),
);

/** The admin's routes, guarded by the session cookie like the real API. */
export const adminHandlers = [
  // Public: a message's status and answer, from its private link (never the email or the message itself).
  http.get(`${API}/feedback/follow/:token`, ({ params }) => {
    const token = String(params.token);
    if (!/^[\w-]{4,100}$/.test(token)) return adminFail(400, "invalid_request");
    const message = messages.find((item) => item.token === token && item.status !== "closed");
    if (!message) return adminFail(404, "not_found");
    return HttpResponse.json(
      {
        kind: message.kind,
        page: message.page,
        createdAt: message.createdAt,
        status: message.reply || message.answeredAt ? "answered" : "open",
        reply: message.reply,
        answeredAt: message.answeredAt,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }),
  http.post(`${API}/admin/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    const admin = team.find((item) => item.email === email?.toLowerCase() && !item.disabled);
    if (!admin || admin.password !== password) return adminFail(401, "invalid_credentials", "Wrong email or password");
    const token = crypto.randomUUID();
    sessions.set(token, admin.id);
    admin.lastLoginAt = new Date().toISOString();
    return HttpResponse.json(
      { admin: publicAdmin(admin) },
      { headers: { "Set-Cookie": `${COOKIE}=${token}; Path=/api/v2/admin; HttpOnly; SameSite=Strict; Max-Age=1209600` } },
    );
  }),
  http.get(`${API}/admin/me`, ({ request }) => {
    const admin = requireAdmin(request);
    return admin instanceof Response ? admin : HttpResponse.json({ admin: publicAdmin(admin) });
  }),
  http.post(`${API}/admin/logout`, ({ request }) => {
    const token = request.headers.get("cookie")?.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];
    if (token) sessions.delete(token);
    return new HttpResponse(null, {
      status: 204,
      headers: { "Set-Cookie": `${COOKIE}=; Path=/api/v2/admin; HttpOnly; SameSite=Strict; Max-Age=0` },
    });
  }),
  http.post(`${API}/admin/password`, async ({ request }) => {
    const admin = requireAdmin(request);
    if (admin instanceof Response) return admin;
    const { current, next } = (await request.json()) as { current?: string; next?: string };
    if (current !== admin.password) return adminFail(401, "invalid_credentials", "Wrong password");
    if (!next || next.length < 12) return adminFail(400, "validation_failed", "next: at least 12 characters");
    admin.password = next;
    return noContent();
  }),

  http.get(`${API}/admin/admins`, ({ request }) => {
    const admin = requireAdmin(request, "admin");
    return admin instanceof Response ? admin : HttpResponse.json({ items: team.map(member) });
  }),
  http.post(`${API}/admin/admins`, async ({ request }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const body = (await request.json()) as { email: string; name: string; role: MockAdmin["role"]; password: string };
    if (team.some((item) => item.email === body.email.toLowerCase())) return adminFail(409, "email_taken", "Email taken");
    if (!body.password || body.password.length < 12) return adminFail(400, "validation_failed", "password: at least 12 characters");
    const created: MockAdmin = {
      id: Math.max(...team.map((item) => item.id)) + 1,
      email: body.email.toLowerCase(),
      name: body.name,
      role: body.role,
      password: body.password,
      disabled: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    team.push(created);
    audit(admin, "admin.create", "admin", created.id);
    return HttpResponse.json(member(created), { status: 201 });
  }),
  http.patch(`${API}/admin/admins/:id`, async ({ params, request }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const target = team.find((item) => item.id === Number(params.id));
    if (!target) return adminFail(404, "not_found");
    const body = (await request.json()) as Partial<Pick<MockAdmin, "name" | "role" | "disabled">>;
    if (target.id === admin.id && (body.disabled || (body.role && body.role !== "admin"))) return adminFail(400, "self_lockout");
    Object.assign(target, body);
    audit(admin, "admin.update", "admin", target.id);
    return noContent();
  }),

  http.get(`${API}/admin/audit`, ({ request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const query = new URL(request.url).searchParams;
    const entity = query.get("entity");
    const entityId = query.get("entityId");
    const limit = Number(query.get("limit") ?? 50);
    return HttpResponse.json({
      items: auditLog.filter((entry) => (!entity || entry.entity === entity) && (!entityId || entry.entityId === entityId)).slice(0, limit),
    });
  }),

  http.get(`${API}/admin/feedback`, ({ request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const query = new URL(request.url).searchParams;
    const status = query.get("status");
    const kind = query.get("kind");
    return HttpResponse.json({
      items: messages
        .filter((message) => (!status || message.status === status) && (!kind || message.kind === kind))
        .map((message) => present({ ...message, corrections: [] })),
    });
  }),
  http.get(`${API}/admin/feedback/:id/screenshot`, ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const message = messages.find((item) => item.id === Number(params.id));
    if (!message?.screenshot) return adminFail(404, "not_found");
    return new HttpResponse(PNG, { headers: { "Content-Type": "image/png" } });
  }),
  http.get(`${API}/admin/feedback/:id`, ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const message = messages.find((item) => item.id === Number(params.id));
    return message ? HttpResponse.json(present(message)) : adminFail(404, "not_found");
  }),
  http.post(`${API}/admin/feedback/:id/answer`, async ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const message = messages.find((item) => item.id === Number(params.id));
    if (!message) return adminFail(404, "not_found");
    const body = (await request.json()) as { reply: string | null; send?: boolean; channel?: "site" | "email" | "none" };
    const channel = body.channel ?? (body.send ? "email" : "none");
    const reply = body.reply?.trim() || null;
    if (channel !== "none" && !reply) return adminFail(400, "empty_reply");
    if (channel === "email" && !message.email) return adminFail(400, "no_email");
    if (channel === "site" && !message.token && !message.readerId) return adminFail(400, "not_followable");
    Object.assign(message, {
      reply: reply ?? message.reply,
      status: message.status === "closed" ? "closed" : "answered",
      answeredAt: message.answeredAt ?? new Date().toISOString(),
    });
    // Email or site answers reach a signed-in reader's inbox.
    if (channel !== "none" && message.readerId) notifyReader(message.readerId, { id: message.id, reply: message.reply });
    audit(admin, channel === "none" ? "feedback.answered" : `feedback.reply.${channel}`, "feedback", message.id);
    return HttpResponse.json(present(message));
  }),
  http.put(`${API}/admin/feedback/:id/note`, async ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const message = messages.find((item) => item.id === Number(params.id));
    if (!message) return adminFail(404, "not_found");
    message.note = ((await request.json()) as { note: string | null }).note || null;
    return HttpResponse.json(present(message));
  }),
  http.post(`${API}/admin/feedback/:id/close`, ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const message = messages.find((item) => item.id === Number(params.id));
    if (!message) return adminFail(404, "not_found");
    Object.assign(message, { status: "closed", closedAt: message.closedAt ?? new Date().toISOString(), email: null, token: null });
    audit(admin, "feedback.close", "feedback", message.id);
    return noContent();
  }),
  http.post(`${API}/admin/feedback/:id/correction`, async ({ params, request }) => {
    const admin = requireAdmin(request, "moderator");
    if (admin instanceof Response) return admin;
    const message = messages.find((item) => item.id === Number(params.id));
    if (!message) return adminFail(404, "not_found");
    const body = (await request.json()) as { status: string; title: string; url: string | null; area?: string; date?: string };
    const area = body.area ?? message.page;
    if (!area) return adminFail(400, "validation_failed", "area: say which section it's about");
    if (!body.title) return adminFail(400, "validation_failed", "title is required");
    const created = {
      id: nextCorrectionId++,
      status: body.status,
      date: body.date ?? "2026-11-16",
      area,
      title: body.title,
      url: body.url,
    };
    message.corrections.push(created);
    audit(admin, "correction.create", "correction", created.id);
    return HttpResponse.json(created, { status: 201 });
  }),
];

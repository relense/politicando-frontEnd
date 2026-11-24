import { http, HttpResponse } from "msw";
import { adminFail, audit, requireAdmin } from "./adminState";

/**
 * Readers' accounts as the administrators see them (asked of the backend: docs/api-handoff.md, «Admin: readers»).
 * Fictional people; three with a story to tell, then enough plain ones to need a second page.
 */
const API = "*/api/v2";

type Status = "active" | "suspended" | "banned" | "deleted";
type Counts = Record<
  "comments" | "forumPosts" | "importa" | "follows" | "saved" | "predictions" | "reportsMade" | "reportsAgainst",
  number
>;
type Activity = { at: string; kind: string; text: string | null; removed: boolean; target: Record<string, unknown> | null };
type Moderation = { at: string; action: string; by: { id: number; name: string } | null; reason: string | null; until: string | null };
type MockReader = {
  id: number;
  username: string;
  email: string | null;
  emailConfirmed: boolean;
  newsletter: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  status: Status;
  suspendedUntil: string | null;
  signupFrom: string | null;
  counts: Counts;
  activity: Activity[];
  moderation: Moderation[];
};

const zero: Counts = { comments: 0, forumPosts: 0, importa: 0, follows: 0, saved: 0, predictions: 0, reportsMade: 0, reportsAgainst: 0 };
const daysAgo = (days: number, hour = 10) => new Date(Date.UTC(2026, 10, 24 - days, hour)).toISOString();

const readers: MockReader[] = [
  {
    id: 812,
    username: "leitora_atenta",
    email: "leitora.atenta@exemplo.pt",
    emailConfirmed: true,
    newsletter: true,
    createdAt: daysAgo(22),
    lastSeenAt: daysAgo(0, 9),
    status: "active",
    suspendedUntil: null,
    signupFrom: "/orcamento/2027/proposta/25391",
    counts: { ...zero, comments: 14, forumPosts: 3, importa: 22, follows: 5, saved: 9, predictions: 4, reportsMade: 1 },
    activity: [
      {
        at: daysAgo(0, 9),
        kind: "comment",
        text: "Concordo com a proposta, mas falta dizer de onde vem o dinheiro.",
        removed: false,
        target: { type: "article", id: 100, title: "Notícia de teste número 100" },
      },
      {
        at: daysAgo(0, 8),
        kind: "vote",
        text: "up",
        removed: false,
        target: { type: "article", id: 99, title: "Notícia de teste número 99" },
      },
      {
        at: daysAgo(1),
        kind: "follow",
        text: null,
        removed: false,
        target: { type: "budget_proposal", id: 28301, title: "Artigo 9.º do Código do IRS", year: 2027 },
      },
      {
        at: daysAgo(2),
        kind: "forum_thread",
        text: "O que acham do novo IRS Jovem?",
        removed: false,
        target: { type: "thread", id: 17, title: "IRS Jovem", board: "geral" },
      },
      {
        at: daysAgo(3),
        kind: "importa",
        text: null,
        removed: false,
        target: { type: "story", id: 100, title: "Notícia de teste número 100" },
      },
      {
        at: daysAgo(4),
        kind: "read",
        text: null,
        removed: false,
        target: { type: "article", id: 98, title: "Notícia de teste número 98" },
      },
      { at: daysAgo(5), kind: "feedback", text: "A página dos deputados não abre no telemóvel.", removed: false, target: null },
    ],
    moderation: [],
  },
  {
    id: 640,
    username: "comentador_zangado",
    email: null,
    emailConfirmed: false,
    newsletter: false,
    createdAt: daysAgo(40),
    lastSeenAt: daysAgo(3),
    status: "suspended",
    suspendedUntil: "2026-12-01T00:00:00.000Z",
    signupFrom: "/article/97",
    counts: { ...zero, comments: 61, forumPosts: 12, reportsAgainst: 7 },
    activity: [
      {
        at: daysAgo(3),
        kind: "comment",
        text: "Texto removido pela moderação.",
        removed: true,
        target: { type: "article", id: 97, title: "Notícia de teste número 97" },
      },
      {
        at: daysAgo(4),
        kind: "forum_post",
        text: "Vocês não percebem nada disto.",
        removed: false,
        target: { type: "thread", id: 17, title: "IRS Jovem", board: "geral" },
      },
    ],
    moderation: [
      { at: daysAgo(3, 12), action: "comment_removed", by: { id: 2, name: "Tomás Rebelo" }, reason: "Insulto", until: null },
      {
        at: daysAgo(3, 13),
        action: "suspended",
        by: { id: 1, name: "Rita Fonseca" },
        reason: "Insultos repetidos",
        until: "2026-12-01T00:00:00.000Z",
      },
    ],
  },
  {
    id: 333,
    username: "conta_de_spam",
    email: "spam@exemplo.pt",
    emailConfirmed: false,
    newsletter: false,
    createdAt: daysAgo(10),
    lastSeenAt: daysAgo(10),
    status: "banned",
    suspendedUntil: null,
    signupFrom: null,
    counts: { ...zero, comments: 30, reportsAgainst: 12 },
    activity: [],
    moderation: [{ at: daysAgo(9), action: "banned", by: { id: 1, name: "Rita Fonseca" }, reason: "Publicidade em massa", until: null }],
  },
  // Plain readers, one a day back in time: enough for a second page.
  ...Array.from({ length: 57 }, (_, index): MockReader => {
    const n = index + 1;
    return {
      id: 1000 + n,
      username: `leitor_${String(n).padStart(3, "0")}`,
      email: n % 3 === 0 ? null : `leitor${n}@exemplo.pt`,
      emailConfirmed: n % 3 === 1,
      newsletter: n % 5 === 0,
      createdAt: daysAgo(n % 45, 8 + (n % 10)),
      lastSeenAt: n % 4 === 0 ? null : daysAgo(n % 20),
      status: "active",
      suspendedUntil: null,
      signupFrom: n % 2 === 0 ? "/" : null,
      counts: { ...zero, comments: n % 7, importa: n % 11, follows: n % 4 },
      activity: [],
      moderation: [],
    };
  }),
];

const PAGE = 50;
const listItem = ({ activity, moderation, ...item }: MockReader) => (void activity, void moderation, item);
const detail = (reader: MockReader) => ({ ...listItem(reader), moderation: reader.moderation });
const total = (reader: MockReader) => Object.values(reader.counts).reduce((sum, value) => sum + value, 0);

export const adminReaderHandlers = [
  http.get(`${API}/admin/readers/stats`, ({ request }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const now = Date.parse(daysAgo(0, 23));
    const within = (value: string | null, days: number) => value !== null && now - Date.parse(value) <= days * 86_400_000;
    const live = readers.filter((reader) => reader.status !== "deleted");
    return HttpResponse.json({
      total: live.length,
      newToday: live.filter((reader) => within(reader.createdAt, 1)).length,
      newThisWeek: live.filter((reader) => within(reader.createdAt, 7)).length,
      active7d: live.filter((reader) => within(reader.lastSeenAt, 7)).length,
      active30d: live.filter((reader) => within(reader.lastSeenAt, 30)).length,
      withEmail: live.filter((reader) => reader.email).length,
      emailConfirmed: live.filter((reader) => reader.emailConfirmed).length,
      suspended: live.filter((reader) => reader.status === "suspended").length,
      banned: live.filter((reader) => reader.status === "banned").length,
      signupsByDay: Array.from({ length: 30 }, (_, index) => {
        const date = daysAgo(29 - index).slice(0, 10);
        return { date, count: live.filter((reader) => reader.createdAt.slice(0, 10) === date).length };
      }),
    });
  }),
  http.get(`${API}/admin/readers`, ({ request }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const search = new URL(request.url).searchParams;
    const q = (search.get("q") ?? "").toLowerCase();
    const email = search.get("email");
    const status = search.get("status");
    const active = Number(search.get("active") ?? 0);
    const sort = search.get("sort") ?? "newest";
    const now = Date.parse(daysAgo(0, 23));
    const list = readers
      .filter(
        (reader) =>
          (!q || reader.username.toLowerCase().includes(q) || (reader.email ?? "").toLowerCase().includes(q)) &&
          (!email ||
            (email === "none"
              ? reader.email === null
              : email === "confirmed"
                ? reader.emailConfirmed
                : reader.email !== null && !reader.emailConfirmed)) &&
          (!status ? reader.status !== "deleted" : reader.status === status) &&
          (!active || (reader.lastSeenAt !== null && now - Date.parse(reader.lastSeenAt) <= active * 86_400_000)),
      )
      .sort((a, b) =>
        sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : sort === "last_seen"
            ? (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "")
            : sort === "most_active"
              ? total(b) - total(a)
              : b.createdAt.localeCompare(a.createdAt),
      );
    const start = Number(search.get("cursor")?.slice(1) ?? 0);
    return HttpResponse.json({
      items: list.slice(start, start + PAGE).map(listItem),
      nextCursor: start + PAGE < list.length ? `c${start + PAGE}` : null,
      total: list.length,
    });
  }),
  http.get(`${API}/admin/readers/:id`, ({ request, params }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const reader = readers.find((item) => item.id === Number(params.id));
    if (!reader) return adminFail(404, "not_found");
    audit(admin, "reader.view", "reader", reader.id);
    return HttpResponse.json(detail(reader));
  }),
  http.get(`${API}/admin/readers/:id/activity`, ({ request, params }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const reader = readers.find((item) => item.id === Number(params.id));
    if (!reader) return adminFail(404, "not_found");
    return HttpResponse.json({ items: reader.activity, nextCursor: null });
  }),
  http.post(`${API}/admin/readers/:id/:action`, async ({ request, params }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const reader = readers.find((item) => item.id === Number(params.id));
    if (!reader) return adminFail(404, "not_found");
    const body = (await request.json().catch(() => null)) as { reason?: unknown; until?: unknown } | null;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 500) return adminFail(400, "invalid_request", "A reason is required");
    const action = String(params.action);
    const at = new Date().toISOString();
    const by = { id: admin.id, name: admin.name };
    let until: string | null = null;
    let removed: number | undefined;
    if (action === "suspend") {
      if (typeof body?.until !== "string" || Number.isNaN(Date.parse(body.until))) return adminFail(400, "invalid_request");
      until = body.until;
      Object.assign(reader, { status: "suspended", suspendedUntil: until });
    } else if (action === "unsuspend" || action === "unban") Object.assign(reader, { status: "active", suspendedUntil: null });
    else if (action === "ban") Object.assign(reader, { status: "banned", suspendedUntil: null });
    else if (action === "remove-content") {
      removed = reader.activity.filter((item) => ["comment", "forum_thread", "forum_post"].includes(item.kind) && !item.removed).length;
      for (const item of reader.activity) if (["comment", "forum_thread", "forum_post"].includes(item.kind)) item.removed = true;
    } else return adminFail(404, "not_found");
    const logged = {
      suspend: "suspended",
      unsuspend: "unsuspended",
      ban: "banned",
      unban: "unbanned",
      "remove-content": "content_removed",
    }[action]!;
    reader.moderation.unshift({ at, action: logged, by, reason, until });
    audit(admin, `reader.${action.replace("-", "_")}`, "reader", reader.id);
    return HttpResponse.json({ ...detail(reader), ...(removed === undefined ? {} : { removed }) });
  }),
  http.delete(`${API}/admin/readers/:id`, async ({ request, params }) => {
    const admin = requireAdmin(request, "admin");
    if (admin instanceof Response) return admin;
    const reader = readers.find((item) => item.id === Number(params.id));
    if (!reader) return adminFail(404, "not_found");
    const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
    if (typeof body?.reason !== "string" || body.reason.trim().length < 3) return adminFail(400, "invalid_request");
    // Deleted accounts are removed, not kept as rows (backend docs/admin-api.md).
    readers.splice(readers.indexOf(reader), 1);
    audit(admin, "reader.delete", "reader", reader.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

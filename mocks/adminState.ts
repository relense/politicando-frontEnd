import { HttpResponse } from "msw";

/** The mock moderation team: fictional people, test-only passwords. */
export type MockAdmin = {
  id: number;
  email: string;
  name: string;
  role: "author" | "moderator" | "admin";
  password: string;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export const COOKIE = "politicando_admin";

export const team: MockAdmin[] = [
  {
    id: 1,
    email: "admin@exemplo.pt",
    name: "Rita Fonseca",
    role: "admin",
    password: "palavra-passe-de-teste",
    disabled: false,
    createdAt: "2026-09-01T10:00:00.000Z",
    lastLoginAt: "2026-11-14T09:30:00.000Z",
  },
  {
    id: 2,
    email: "moderador@exemplo.pt",
    name: "Tomás Rebelo",
    role: "moderator",
    password: "palavra-passe-de-teste",
    disabled: false,
    createdAt: "2026-10-01T10:00:00.000Z",
    lastLoginAt: null,
  },
  {
    id: 3,
    email: "autora@exemplo.pt",
    name: "Inês Carvalho",
    role: "author",
    password: "palavra-passe-de-teste",
    disabled: false,
    createdAt: "2026-11-01T10:00:00.000Z",
    lastLoginAt: null,
  },
];

/** Session token → admin id. */
export const sessions = new Map<string, number>();

const RANK = { author: 0, moderator: 1, admin: 2 } as const;

export const adminFail = (status: number, code: string, message = code) => HttpResponse.json({ error: { code, message } }, { status });

/** The signed-in admin, or the error to send back. */
export function requireAdmin(request: Request, role: MockAdmin["role"] = "author"): MockAdmin | Response {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === COOKIE)?.[1];
  const admin = team.find((member) => member.id === (token ? sessions.get(token) : undefined));
  if (!admin || admin.disabled) return adminFail(401, "unauthenticated", "Sign in first");
  if (RANK[admin.role] < RANK[role]) return adminFail(403, "forbidden", "Your role can't do this");
  return admin;
}

export type MockAuditEntry = {
  id: number;
  admin: { id: number; name: string } | null;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  at: string;
};

export const auditLog: MockAuditEntry[] = [];
let nextAuditId = 1;

export function audit(admin: MockAdmin, action: string, entity: string, entityId: number | string) {
  auditLog.unshift({
    id: nextAuditId++,
    admin: { id: admin.id, name: admin.name },
    action,
    entity,
    entityId: String(entityId),
    before: null,
    after: null,
    at: new Date().toISOString(),
  });
}

/** Comments hidden by the moderation, by id: gone from the public lists. */
export const hiddenComments = new Map<number, string>();

export type MockReport = {
  kind: "thread" | "post" | "comment" | "article";
  targetId: number;
  reasons: string[];
  details: string[];
  reports: number;
  firstReportedAt: string;
  resolution: "hide" | "dismiss" | null;
};

/** Readers' reports, grouped by what they report. A new report on something already resolved opens it again. */
export const reportsStore: MockReport[] = [
  {
    kind: "comment",
    targetId: 2,
    reasons: ["insult"],
    details: ["Comentário de teste denunciado."],
    reports: 2,
    firstReportedAt: "2026-11-15T09:00:00.000Z",
    resolution: null,
  },
];

export function addReport(kind: MockReport["kind"], targetId: number, reason: string, details: string | null | undefined) {
  let open = reportsStore.find((report) => report.kind === kind && report.targetId === targetId && report.resolution === null);
  if (!open) {
    open = { kind, targetId, reasons: [], details: [], reports: 0, firstReportedAt: new Date().toISOString(), resolution: null };
    reportsStore.unshift(open);
  }
  open.reports += 1;
  if (!open.reasons.includes(reason)) open.reasons.push(reason);
  if (details) open.details.push(details);
}

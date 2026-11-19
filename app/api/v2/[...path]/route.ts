import type { NextRequest } from "next/server";
import { forwardToApi } from "@/lib/api/proxy";

/**
 * Readers' accounts (backend docs/accounts-api.md): the session cookie, politicando_session, is scoped to /api/v2, so
 * everything that needs it goes through the site's own server (lib/api/proxy.ts): the account (/auth, /me) and every
 * write (comments, votes, likes, Importa, the forum, reports). Public reads keep going straight to the API, cached,
 * and never carry the cookie. The team's area has its own route, /api/v2/admin.
 */
type Context = { params: Promise<{ path: string[] }> };

const ACCOUNT = new Set(["auth", "me"]);

async function forward(request: NextRequest, { params }: Context): Promise<Response> {
  const { path } = await params;
  const first = path[0] ?? "";
  const read = request.method === "GET" || request.method === "HEAD";
  // Not a general proxy: reads only for the account; writes for anything but the team's area.
  if (first === "admin" || (read && !ACCOUNT.has(first))) {
    return Response.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
  }
  return forwardToApi(request, path);
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST, forward as PUT };

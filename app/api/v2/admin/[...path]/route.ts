import type { NextRequest } from "next/server";
import { forwardToApi } from "@/lib/api/proxy";

/**
 * The admin talks to the API through the site's own server (see lib/api/proxy.ts). The team's cookie is
 * SameSite=Strict and scoped to /api/v2/admin.
 */
type Context = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, { params }: Context): Promise<Response> {
  const { path } = await params;
  return forwardToApi(request, ["admin", ...path]);
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST, forward as PUT };

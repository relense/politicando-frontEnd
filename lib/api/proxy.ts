import type { NextRequest } from "next/server";
import { API_BASE_URL } from "@/lib/api/client";
import { serverHeaders } from "@/lib/api/serverHeaders";

/**
 * Calls to the API made through the site's own server, at the same path the API uses (/api/v2/…). The API's session
 * cookies (the team's and the readers') are scoped to /api/v2: served from the site's origin they are always
 * first-party, whatever domains the two services have (two onrender.com addresses count as different sites).
 * The server also adds the shared key and the reader's IP, so limits count per person, not per site.
 * Never cached: every answer is about one person.
 */

const PASSED_IN = ["content-type", "cookie", "accept"];
// Not content-length: fetch has already decompressed the body, so the API's length would be wrong.
const PASSED_OUT = ["content-type", "cache-control", "content-disposition"];

/** The cookie belongs to this site now: no Domain of the API's. Path and flags stay as the API set them. */
export const ownCookie = (cookie: string) =>
  cookie
    .split(";")
    .filter((part) => !/^\s*domain=/i.test(part))
    .join(";");

export async function forwardToApi(request: NextRequest, path: string[]): Promise<Response> {
  const target = `${API_BASE_URL}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of PASSED_IN) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const [name, value] of Object.entries(await serverHeaders(false))) headers.set(name, value);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return Response.json({ error: { code: "api_unavailable", message: "The API could not be reached" } }, { status: 502 });
  }

  const out = new Headers({ "cache-control": "no-store" });
  for (const name of PASSED_OUT) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set("cache-control", "no-store");
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", ownCookie(cookie));
  const empty = upstream.status === 204 || upstream.status === 304;
  return new Response(empty ? null : upstream.body, { status: upstream.status, headers: out });
}

import { timingSafeEqual } from "node:crypto";
import { type CacheTag, isCacheTag } from "@/lib/api/cacheTags";

/**
 * The backend's ping after each job (POST /api/revalidate, backend docs/revalidate.md): `Authorization: Bearer
 * <REVALIDATE_SECRET>` and `{ "tags": ["news", …] }` (`changed`, the older name, is read too). Each known tag's cached
 * requests (lib/api/cacheTags.ts) are dropped by `drop`, which the route makes an immediate expiry: the next visit fetches
 * fresh instead of being served the old copy. Unknown tags are ignored, so the backend can add more without breaking this.
 */
type Options = { secret: string | undefined; drop: (tag: CacheTag) => void };

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** Same length and same bytes, in constant time. */
function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function answerRevalidate(request: Request, { secret, drop }: Options): Promise<Response> {
  if (!secret) return fail(503, "not_configured", "REVALIDATE_SECRET is not set on the site");
  const given = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!sameSecret(given, secret)) return fail(401, "unauthorized", "Missing or wrong secret");

  const body: unknown = await request.json().catch(() => null);
  const fields = body && typeof body === "object" ? (body as { tags?: unknown; changed?: unknown }) : {};
  const sent = fields.tags ?? fields.changed;
  if (!Array.isArray(sent) || sent.length === 0) return fail(400, "invalid_request", 'Expected { "tags": [...] }');

  const tags = [...new Set(sent.filter(isCacheTag))];
  for (const tag of tags) drop(tag);
  return Response.json({ revalidated: tags });
}

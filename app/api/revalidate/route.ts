import { revalidateTag } from "next/cache";
import { answerRevalidate } from "@/lib/revalidate";

/**
 * The backend, after each job (backend docs, frontend contract in lib/revalidate.ts). `expire: 0`: the old copy is never
 * served again, so the next reader gets fresh data, not the stale copy while a new one builds.
 */
export async function POST(request: Request): Promise<Response> {
  return answerRevalidate(request, { secret: process.env.REVALIDATE_SECRET, drop: (tag) => revalidateTag(tag, { expire: 0 }) });
}

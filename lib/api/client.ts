import { z } from "zod";
import type { Article, ArticlePage, Comment, NewComment, Party } from "@/lib/types";
import { mapArticle, mapComment, mapParty } from "./mappers";
import { articleDetailSchema, articlePageSchema, commentSchema, errorSchema, partySchema } from "./schemas";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v2";
const REVALIDATE_SECONDS = 60;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit & { next?: { revalidate?: number } }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch (cause) {
    throw new ApiError(`Network error on ${path}: ${String(cause)}`);
  }
  const json: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const failure = errorSchema.safeParse(json);
    throw new ApiError(
      failure.success ? failure.data.error.message : `${response.status} on ${path}`,
      response.status,
      failure.success ? failure.data.error.code : null,
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError(`Unexpected response from ${path}: ${parsed.error.message}`, response.status);
  return parsed.data;
}

const cached = { next: { revalidate: REVALIDATE_SECONDS } };

export async function getParties(): Promise<Party[]> {
  return (await request("/parties", z.array(partySchema), cached)).map(mapParty);
}

export type FeedQuery = { party?: string; cursor?: string; limit?: number };

export async function getFeedPage({ party, cursor, limit }: FeedQuery = {}): Promise<ArticlePage> {
  const query = new URLSearchParams();
  if (party !== undefined) query.set("party", party);
  if (cursor !== undefined) query.set("cursor", cursor);
  if (limit !== undefined) query.set("limit", String(limit));
  const search = query.size > 0 ? `?${query}` : "";

  const page = await request(`/articles${search}`, articlePageSchema, cached);
  return { articles: page.items.map(mapArticle), nextCursor: page.nextCursor };
}

export async function getArticle(id: number): Promise<Article> {
  return mapArticle(await request(`/articles/${id}`, articleDetailSchema, cached));
}

export async function getComments(articleId: number): Promise<Comment[]> {
  const comments = await request(`/articles/${articleId}/comments`, z.array(commentSchema), { cache: "no-store" });
  return comments.map(mapComment);
}

export async function createComment(input: NewComment): Promise<Comment> {
  const created = await request(`/articles/${input.articleId}/comments`, commentSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The API rejects unknown fields, so only send what it documents.
    body: JSON.stringify({
      ...(input.username ? { username: input.username } : {}),
      body: input.text,
      ...(input.parentId !== null ? { parentId: input.parentId } : {}),
      recaptchaToken: input.captchaToken,
    }),
  });
  return mapComment(created);
}

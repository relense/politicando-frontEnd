import { z } from "zod";
import type {
  Article,
  ArticlePage,
  Comment,
  DeputyDetail,
  DeputyVotesPage,
  Government,
  GovernmentMemberDetail,
  InitiativeDetail,
  InitiativePage,
  InitiativeStatus,
  NewComment,
  Parliament,
  Party,
} from "@/lib/types";
import {
  mapArticle,
  mapComment,
  mapDeputyDetail,
  mapDeputyVotes,
  mapGovernment,
  mapGovernmentMemberDetail,
  mapInitiative,
  mapInitiativeDetail,
  mapParliament,
  mapParty,
} from "./mappers";
import {
  articlePageSchema,
  articleSchema,
  commentSchema,
  deputyDetailSchema,
  deputyVotesPageSchema,
  errorSchema,
  governmentMemberDetailSchema,
  governmentSchema,
  initiativeDetailSchema,
  initiativePageSchema,
  parliamentSchema,
  partySchema,
} from "./schemas";

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
  const parties = (await request("/parties", z.array(partySchema), cached)).map(mapParty);
  // Alphabetical on purpose: the order must not suggest any ranking between parties.
  return parties.sort((a, b) => a.acronym.localeCompare(b.acronym, "pt", { sensitivity: "base" }));
}

/** Builds "?a=1&b=2" from the values that are set, or "" when none are. */
function searchOf(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) query.set(key, String(value));
  return query.size > 0 ? `?${query}` : "";
}

export type FeedQuery = { party?: string; deputy?: number; cursor?: string; limit?: number };

export async function getFeedPage({ party, deputy, cursor, limit }: FeedQuery = {}): Promise<ArticlePage> {
  const search = searchOf({ party, deputy, cursor, limit });

  const page = await request(`/articles${search}`, articlePageSchema, cached);
  return { articles: page.items.map(mapArticle), nextCursor: page.nextCursor };
}

export async function getArticle(id: number): Promise<Article> {
  return mapArticle(await request(`/articles/${id}`, articleSchema, cached));
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

export async function getParliament(): Promise<Parliament> {
  return mapParliament(await request("/parliament", parliamentSchema, cached));
}

export async function getDeputy(id: number): Promise<DeputyDetail> {
  return mapDeputyDetail(await request(`/deputies/${id}`, deputyDetailSchema, cached));
}

export type InitiativeQuery = { status?: InitiativeStatus; deputy?: number; party?: string; cursor?: string; limit?: number };

export async function getInitiatives({ status, deputy, party, cursor, limit }: InitiativeQuery = {}): Promise<InitiativePage> {
  const page = await request(`/initiatives${searchOf({ status, deputy, party, cursor, limit })}`, initiativePageSchema, cached);
  return { initiatives: page.items.map(mapInitiative), nextCursor: page.nextCursor };
}

export async function getInitiative(id: number): Promise<InitiativeDetail> {
  return mapInitiativeDetail(await request(`/initiatives/${id}`, initiativeDetailSchema, cached));
}

export async function getDeputyVotes(id: number, { cursor, limit }: { cursor?: string; limit?: number } = {}): Promise<DeputyVotesPage> {
  return mapDeputyVotes(await request(`/deputies/${id}/votes${searchOf({ cursor, limit })}`, deputyVotesPageSchema, cached));
}

export async function getGovernment(): Promise<Government> {
  return mapGovernment(await request("/government", governmentSchema, cached));
}

export async function getGovernmentMember(id: string): Promise<GovernmentMemberDetail> {
  return mapGovernmentMemberDetail(await request(`/government/members/${encodeURIComponent(id)}`, governmentMemberDetailSchema, cached));
}

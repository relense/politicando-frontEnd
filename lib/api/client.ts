import { z } from "zod";
import type {
  Article,
  ArticlePage,
  Comment,
  DeputyDetail,
  DeputyVotesPage,
  Election,
  UpcomingElection,
  ElectionResult,
  ElectionType,
  Government,
  GovernmentHistory,
  GovernmentMemberDetail,
  InitiativeDetail,
  InitiativePage,
  InitiativeStatus,
  NewComment,
  Parliament,
  Party,
  PartyOverview,
  PartyStanding,
  PresidencyStatus,
  TimelineEvent,
  EditorialDetail,
  EditorialKind,
  EditorialPage,
} from "@/lib/types";
import {
  mapArticle,
  mapComment,
  mapDeputyDetail,
  mapDeputyVotes,
  mapElectionResult,
  mapElections,
  mapGovernment,
  mapGovernmentHistory,
  mapGovernmentMemberDetail,
  mapInitiative,
  mapInitiativeDetail,
  mapParliament,
  mapParty,
  mapPartyOverview,
  mapPartyStanding,
  mapTimeline,
  mapEditorialDetail,
  mapEditorialPost,
} from "./mappers";
import {
  articlePageSchema,
  articleSchema,
  commentSchema,
  deputyDetailSchema,
  deputyVotesPageSchema,
  electionResultSchema,
  electionsSchema,
  errorSchema,
  governmentHistorySchema,
  governmentMemberDetailSchema,
  governmentSchema,
  initiativeDetailSchema,
  initiativePageSchema,
  parliamentSchema,
  partySchema,
  timelineSchema,
  editorialDetailSchema,
  editorialPageSchema,
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

export async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit & { next?: { revalidate?: number } }): Promise<T> {
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

export const cached = { next: { revalidate: REVALIDATE_SECONDS } };

export async function getParties(): Promise<Party[]> {
  const parties = (await request("/parties", z.array(partySchema), cached)).map(mapParty);
  // Alphabetical on purpose: the order must not suggest any ranking between parties.
  return parties.sort((a, b) => a.acronym.localeCompare(b.acronym, "pt", { sensitivity: "base" }));
}

/** Builds "?a=1&b=2" from the values that are set, or "" when none are. */
export function searchOf(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) query.set(key, String(value));
  return query.size > 0 ? `?${query}` : "";
}

/**
 * `q`: words in the title or excerpt, accents and case ignored. `source`: an outlet's domain, as in `article.source`.
 * `party` and `source` take one value or several: several match any of them (any of the parties, from any of the outlets).
 */
export type FeedQuery = {
  party?: string | string[];
  deputy?: number;
  q?: string;
  source?: string | string[];
  cursor?: string;
  limit?: number;
  /** Newest first (default), or most commented first among those published in the last `since` hours. */
  sort?: "comments";
  since?: number;
};

/** News per page on the feeds: a screenful or three, then a button for more. */
export const FEED_PAGE_SIZE = 30;

const listOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);

export async function getFeedPage({ party, deputy, q, source, cursor, limit, sort, since }: FeedQuery = {}): Promise<ArticlePage> {
  // Several values go as one comma-separated list: any of the parties, from any of the outlets.
  const search = searchOf({
    party: listOf(party).join(",") || undefined,
    source: listOf(source).join(",") || undefined,
    deputy,
    q: q || undefined,
    cursor,
    limit,
    sort,
    since: since ? `${since}h` : undefined,
  });
  const page = await request(`/articles${search}`, articlePageSchema, cached);
  return { articles: page.items.map(mapArticle), nextCursor: page.nextCursor, total: page.total ?? null };
}

/** The articles with the most visible comments from the last `hours`; only those with at least one. */
export async function getMostCommented(limit = 3, hours = 24): Promise<Article[]> {
  const page = await request(`/articles${searchOf({ sort: "comments", since: `${hours}h`, limit })}`, articlePageSchema, cached);
  return page.items.map(mapArticle);
}

/** Every outlet with articles, most articles first: domains, shown with `sourceName()`. */
export async function getSources(): Promise<{ domain: string; count: number }[]> {
  const data = await request("/articles/sources", z.object({ items: z.array(z.object({ name: z.string(), count: z.number() })) }), hourly);
  return data.items.map((item) => ({ domain: item.name, count: item.count }));
}

/** Double opt-in: the API emails a confirmation link. The answer is the same whether or not the address was already in. */
export async function subscribeNewsletter(email: string, captchaToken: string): Promise<void> {
  await request("/newsletter/subscribe", z.object({ status: z.string() }), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, recaptchaToken: captchaToken }),
  });
}

/** The municipality containing a point. 404 (`not_found`) outside Portugal. The API doesn't keep the coordinates. */
export async function locatePlace(lat: number, lon: number): Promise<{ key: string; name: string }> {
  const lat5 = Math.round(lat * 1e5) / 1e5;
  const lon5 = Math.round(lon * 1e5) / 1e5;
  return request(`/places/locate${searchOf({ lat: lat5, lon: lon5 })}`, z.object({ key: z.string(), name: z.string() }), {
    cache: "no-store",
  });
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

export type InitiativeQuery = {
  status?: InitiativeStatus;
  deputy?: number;
  party?: string;
  presidency?: PresidencyStatus;
  topic?: string;
  /** A phase, as the API names them (see INITIATIVE_STAGES). */
  stage?: string;
  /** Words from the title, or the initiative's number. */
  q?: string;
  /** Newest first unless "oldest". */
  sort?: "newest" | "oldest";
  cursor?: string;
  limit?: number;
};

export async function getInitiatives({
  status,
  deputy,
  party,
  presidency,
  topic,
  stage,
  q,
  sort,
  cursor,
  limit,
}: InitiativeQuery = {}): Promise<InitiativePage> {
  const query = searchOf({ status, deputy, party, presidency, topic, stage, q, sort: sort === "oldest" ? sort : undefined, cursor, limit });
  const page = await request(`/initiatives${query}`, initiativePageSchema, cached);
  return {
    initiatives: page.items.map(mapInitiative),
    nextCursor: page.nextCursor,
    total: page.total ?? null,
    stages: (page.stages ?? []).map((item) => ({ ...item, plain: item.plain ?? "" })),
  };
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

/** Election results change only when an import finishes, so they are cached for an hour. */
export const hourly = { next: { revalidate: 3600 } };

export async function getElections(type?: ElectionType): Promise<Election[]> {
  const query = type ? `?type=${type}` : "";
  return mapElections(await request(`/elections${query}`, electionsSchema, hourly));
}

/** The elections menu: every election, and the next one of each kind. */
export async function getElectionsMenu(): Promise<{ elections: Election[]; upcoming: UpcomingElection[] }> {
  const data = await request("/elections", electionsSchema, hourly);
  return {
    elections: mapElections(data),
    upcoming: data.upcoming.map((item) => ({
      type: item.type,
      name: item.name,
      year: item.year ?? null,
      date: item.date ?? null,
      confirmed: item.confirmed ?? false,
      window: item.window ?? null,
      basis: item.basis ?? null,
    })),
  };
}

/** Results in one place (the top level without `place`) for one body (`organ`, the main one by default). */
export async function getElectionResult(id: string, { place, organ }: { place?: string; organ?: string } = {}): Promise<ElectionResult> {
  const path = place ? `/elections/${encodeURIComponent(id)}/places/${encodeURIComponent(place)}` : `/elections/${encodeURIComponent(id)}`;
  const query = organ ? `?organ=${encodeURIComponent(organ)}` : "";
  return mapElectionResult(await request(`${path}${query}`, electionResultSchema, hourly));
}

/**
 * Each party's seats now and votes in the latest legislativas, from the list of parties ordered by seats.
 * Empty when the API doesn't send them, so the order by name is the only one offered.
 */
/** Every party with its leader, seats and latest result, most seats first (ties by name). */
export async function getPartyOverview(): Promise<PartyOverview[]> {
  return (await request("/parties?sort=seats", z.array(partySchema), cached)).map(mapPartyOverview);
}

export async function getPartyStandings(): Promise<Record<string, PartyStanding>> {
  try {
    const parties = await request("/parties?sort=seats", z.array(partySchema), cached);
    const standings = parties.flatMap((party) => {
      const standing = mapPartyStanding(party);
      return standing ? [[party.slug, standing] as const] : [];
    });
    return Object.fromEntries(standings);
  } catch {
    return {};
  }
}

/** Every government since 1974, newest first. History changes rarely, so it is cached for an hour. */
export async function getGovernmentHistory(): Promise<GovernmentHistory> {
  return mapGovernmentHistory(await request("/governments/history", governmentHistorySchema, hourly));
}

/** Elections and Presidents' terms, newest first. */
export async function getTimeline(kinds: ("election" | "president")[] = ["election", "president"]): Promise<TimelineEvent[]> {
  return mapTimeline(await request(`/timeline?kinds=${kinds.join(",")}`, timelineSchema, hourly));
}

export type EditorialQuery = {
  featured?: boolean;
  kind?: EditorialKind;
  tag?: string;
  page?: number;
  limit?: number;
  /** The most read over the last `days`. */
  sort?: "popular";
  days?: number;
};

/** Our own posts, newest first. */
export async function getEditorial({ featured, kind, tag, page, limit, sort, days }: EditorialQuery = {}): Promise<EditorialPage> {
  const query = searchOf({ featured: featured === undefined ? undefined : String(featured), kind, tag, page, limit, sort, days });
  const result = await request(`/editorial${query}`, editorialPageSchema, cached);
  return { items: result.items.map(mapEditorialPost), total: result.total };
}

export async function getEditorialPost(slug: string): Promise<EditorialDetail> {
  return mapEditorialDetail(await request(`/editorial/${encodeURIComponent(slug)}`, editorialDetailSchema, cached));
}

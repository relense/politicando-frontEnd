import { decode } from "he";
import { z } from "zod";
import type { Article, ArticleKind, PersonMention } from "@/lib/types";
import { formatRelative, lisbonDay, lisbonDayFrom } from "@/lib/format";
import { sourceName } from "@/lib/sources";
import { cached, idBatches, request, searchOf } from "./client";
import { mapArticle, safeHttpUrl } from "./mappers";
import { articleSchema, peopleSchema } from "./schemas";

/**
 * Stories: the same news told by several outlets, as one card ("7 jornais contaram isto"). Readers mark a story
 * "Importa" and comment on the story, not on each outlet's version. Contract: the backend's docs/stories-api.md.
 */

const party = z.object({ slug: z.string(), acronym: z.string(), name: z.string() });
const initiative = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["approved", "rejected", "in_progress", "withdrawn"]).nullish(),
  lastVote: z.object({ date: z.string(), phase: z.string(), result: z.string(), unanimous: z.boolean() }).nullish(),
});

const tagSchema = z.object({ slug: z.string(), label: z.string(), name: z.string(), kind: z.string() });

const debateComment = z.object({
  id: z.number(),
  username: z.string().nullable(),
  body: z.string(),
  likes: z.number(),
  createdAt: z.string(),
});

const storySchema = z.object({
  id: z.number(),
  title: z.string(),
  /** Not in the API yet (asked of the backend): the excerpt of the version whose headline is the story's. */
  excerpt: z.string().nullish(),
  imageUrl: z.string().nullable(),
  firstPublishedAt: z.string(),
  lastPublishedAt: z.string(),
  articleCount: z.number(),
  sourceCount: z.number(),
  /** "Hoje em 5" only: the outlets with an article in the last 24 hours. */
  recentSourceCount: z.number().nullish(),
  sources: z.array(
    z.object({
      name: z.string(),
      articleId: z.number(),
      title: z.string(),
      url: z.string(),
      publishedAt: z.string(),
      /** Asked of the backend: this outlet's own photo (null when it has none). */
      imageUrl: z.string().nullish(),
    }),
  ),
  parties: z.array(party),
  deputies: z.array(z.object({ id: z.number(), name: z.string(), party: z.string().nullable() })).default([]),
  government: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  president: z.object({ id: z.string(), name: z.string() }).nullish(),
  /** Everyone with a page named across the versions, most often first. */
  people: peopleSchema.optional(),
  initiatives: z.array(initiative).default([]),
  importa: z.number(),
  importance: z.number(),
  commentCount: z.number(),
  /** Events first ("OE2027"), then at most two topics ("Habitação"); `label` is the hashtag, `name` in full. */
  tags: z.array(tagSchema).default([]),
  /** The most liked comment on each side; either may be null. */
  debate: z.object({ agree: debateComment.nullable(), disagree: debateComment.nullable() }).nullish(),
  /** The ids of older stories joined into this one ([] usually, and from an older API). */
  mergedFrom: z.array(z.number()).catch([]),
  /** News (most), or an opinion piece, podcast or newsletter: a card of one article. Null from an older API. */
  kind: articleSchema.shape.kind,
});

const storyDetailSchema = storySchema.extend({
  articles: z.array(articleSchema),
  /** The "Contexto" box: our blog posts that explain it, and coming events about it. */
  context: z
    .object({
      explainers: z.array(z.object({ slug: z.string(), title: z.string(), kind: z.string(), publishedAt: z.string() })).default([]),
      agenda: z
        .array(
          z.object({
            id: z.union([z.string(), z.number()]).transform(String),
            title: z.string(),
            kind: z.string(),
            startsAt: z.string(),
            allDay: z.boolean().nullish(),
          }),
        )
        .default([]),
    })
    .nullish(),
});

/** A story with no version left (its articles hidden or removed) has nothing to show or open: left out. */
export const storyListSchema = z.array(storySchema).transform((items) => items.filter((item) => item.sources.length > 0));
const storyPageSchema = z.object({ items: storyListSchema, nextCursor: z.string().nullable(), total: z.number().nullish() });

export type StoryTag = { slug: string; label: string; name: string; kind: string };
export type StoryVersion = {
  source: string;
  sourceDomain: string;
  articleId: number;
  title: string;
  url: string | null;
  publishedAt: string;
  /** This outlet's own photo, null when it has none; undefined while the API doesn't say per outlet. */
  imageUrl?: string | null;
};
export type DebateComment = { id: number; username: string | null; text: string; likes: number; createdAt: string };

export type Story = {
  id: number;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  firstPublishedAt: string;
  lastPublishedAt: string;
  sourceCount: number;
  /** "Hoje em 5" only: the outlets with an article in the last 24 hours; null elsewhere or from an older API. */
  recentSourceCount: number | null;
  /** One per outlet, first to publish first, each with its own headline. */
  versions: StoryVersion[];
  parties: { slug: string; acronym: string; name: string }[];
  deputies: { id: number; name: string; party: string | null }[];
  government: { id: string; name: string }[];
  president: { id: string; name: string } | null;
  /** Everyone with a page named across the versions, most often first. */
  people: PersonMention[];
  initiatives: { id: number; title: string; status: string | null; lastVote: { date: string; result: string } | null }[];
  /** Readers who marked it "Importa", and 0–1 for the semicircle of dots. */
  importa: number;
  importance: number;
  commentCount: number;
  tags: StoryTag[];
  /** The most liked comment on each side; null unless both exist (one side alone isn't a debate). */
  debate: { agree: DebateComment; disagree: DebateComment } | null;
  /** Older stories joined into this one: a reader's mark (read, Importa, followed) on one of them is on this story. */
  mergedFrom: number[];
  /** News, or a card of one opinion piece, podcast or newsletter; null from an older API. */
  kind?: ArticleKind | null;
};

/** Every id this story answers to: its own, then the older ones joined into it. */
export const storyIds = (story: Pick<Story, "id" | "mergedFrom">): number[] => [story.id, ...story.mergedFrom];

/** Whether a list the reader keeps (read, followed…) has this story, under its id or an old one. */
export function knowsStory(ids: readonly number[] | ReadonlySet<number>, story: Pick<Story, "id" | "mergedFrom">): boolean {
  const has = (id: number) => ("has" in ids ? ids.has(id) : ids.includes(id));
  return storyIds(story).some(has);
}

export type StoryDetail = Story & {
  articles: Article[];
  context: {
    explainers: { slug: string; title: string; kind: string; publishedAt: string }[];
    agenda: { id: string; title: string; kind: string; startsAt: string; allDay: boolean }[];
  };
};

export type StoryPage = { stories: Story[]; nextCursor: string | null; total: number | null };

function mapStory(api: z.infer<typeof storySchema>): Story {
  return {
    id: api.id,
    mergedFrom: api.mergedFrom.filter((id) => id !== api.id),
    kind: api.kind ?? null,
    title: decode(api.title),
    excerpt: api.excerpt ? decode(api.excerpt) : null,
    imageUrl: safeHttpUrl(api.imageUrl),
    firstPublishedAt: api.firstPublishedAt,
    lastPublishedAt: api.lastPublishedAt,
    sourceCount: api.sourceCount,
    recentSourceCount: api.recentSourceCount ?? null,
    versions: api.sources.map((item) => ({
      source: sourceName(item.name),
      sourceDomain: item.name,
      articleId: item.articleId,
      title: decode(item.title),
      url: safeHttpUrl(item.url),
      publishedAt: item.publishedAt,
      ...(item.imageUrl !== undefined && { imageUrl: safeHttpUrl(item.imageUrl) }),
    })),
    parties: api.parties,
    deputies: api.deputies,
    government: api.government,
    president: api.president ?? null,
    people: (api.people ?? []).map((person) => ({ ...person, name: decode(person.name) })),
    initiatives: api.initiatives.map((item) => ({
      id: item.id,
      title: decode(item.title),
      status: item.status ?? null,
      lastVote: item.lastVote ? { date: item.lastVote.date, result: item.lastVote.result } : null,
    })),
    importa: api.importa,
    importance: Math.min(1, Math.max(0, api.importance)),
    commentCount: api.commentCount,
    tags: api.tags,
    debate:
      api.debate?.agree && api.debate.disagree ? { agree: mapDebate(api.debate.agree), disagree: mapDebate(api.debate.disagree) } : null,
  };
}

const mapDebate = (comment: z.infer<typeof debateComment>): DebateComment => ({
  id: comment.id,
  username: comment.username || null,
  text: comment.body,
  likes: comment.likes,
  createdAt: comment.createdAt,
});

export type StorySort = "newest" | "top" | "coverage" | "comments";
export type StoryQuery = {
  party?: string | string[];
  source?: string | string[];
  q?: string;
  /** Only stories with this tag ("oe2027"). */
  tag?: string;
  sort?: StorySort;
  period?: "today" | "yesterday" | "week" | "month";
  cursor?: string;
  limit?: number;
};

const joined = (value: string | string[] | undefined) => (Array.isArray(value) ? value.join(",") || undefined : value || undefined);

/** The feed as stories, newest version first unless sorted otherwise. */
export async function getStories({ party, source, q, tag, sort, period, cursor, limit }: StoryQuery = {}): Promise<StoryPage> {
  const query = searchOf({
    party: joined(party),
    source: joined(source),
    q: q || undefined,
    tag: tag || undefined,
    sort: sort === "newest" ? undefined : sort,
    period,
    cursor,
    limit,
  });
  const page = await request(`/stories${query}`, storyPageSchema, cached);
  return { stories: page.items.map(mapStory), nextCursor: page.nextCursor, total: page.total ?? null };
}

/** A story with every outlet's version and its debate pair; null when it doesn't exist. */
export async function getStory(id: number): Promise<StoryDetail | null> {
  try {
    const api = await request(`/stories/${id}`, storyDetailSchema, cached);
    if (api.sources.length === 0) return null;
    return {
      ...mapStory(api),
      articles: api.articles.map(mapArticle),
      context: {
        explainers: (api.context?.explainers ?? []).map((item) => ({ ...item, title: decode(item.title) })),
        agenda: (api.context?.agenda ?? []).map((item) => ({ ...item, title: decode(item.title), allDay: item.allDay ?? false })),
      },
    };
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  }
}

const weekday = new Intl.DateTimeFormat("pt-PT", { weekday: "long", timeZone: "Europe/Lisbon" });

/**
 * "4 jornais · há 2 h · desde ontem": how fresh a "Hoje em 5" story is. The outlets of the last 24 hours, the latest
 * article's age, and the day it began when that wasn't today.
 */
export function freshnessLine(story: Pick<Story, "recentSourceCount" | "firstPublishedAt" | "lastPublishedAt">, now: number): string {
  const count = story.recentSourceCount;
  const began = lisbonDay(story.firstPublishedAt);
  const since =
    began === lisbonDayFrom(now, 0)
      ? null
      : began === lisbonDayFrom(now, -1)
        ? "desde ontem"
        : `desde ${weekday.format(new Date(story.firstPublishedAt)).replace("-feira", "")}`;
  return [count === null ? null : `${count} ${count === 1 ? "jornal" : "jornais"}`, formatRelative(story.lastPublishedAt, now), since]
    .filter(Boolean)
    .join(" · ");
}

/** "Hoje em 5": the stories of the last 24 hours that matter most. Empty when the API can't say. */
export async function getToday(): Promise<Story[]> {
  try {
    const { items } = await request("/today", z.object({ items: storyListSchema }), cached);
    return items.map(mapStory);
  } catch {
    return [];
  }
}

/** Marks a story "Importa" (1) or takes the mark back (0). From the browser. */
export async function markImporta(id: number, value: 1 | 0): Promise<{ importa: number; importance: number; mine: number }> {
  return request(`/stories/${id}/vote`, z.object({ importa: z.number(), importance: z.number(), mine: z.number() }), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}

/** The saved stories, by id (newest first: the first 100 are asked for), from the browser and never cached. */
export async function getStoriesByIds(ids: number[]): Promise<Story[]> {
  if (ids.length === 0) return [];
  const pages = await Promise.all(
    idBatches(ids).map((batch) =>
      request(`/stories${searchOf({ ids: batch.join(","), limit: batch.length })}`, storyPageSchema, { cache: "no-store" }),
    ),
  );
  return pages.flatMap((page) => page.items.map(mapStory)).sort((a, b) => b.lastPublishedAt.localeCompare(a.lastPublishedAt));
}

/** The version whose headline is the story's, or the first one: whose name heads the card and whose page it opens. */
export const leadOf = (story: Pick<Story, "title" | "versions">) =>
  story.versions.find((item) => item.title === story.title) ?? story.versions[0]!;

/** Where a story is read: the page of the version whose headline it shows, or the first one. */
export const storyPath = (story: Pick<Story, "title" | "versions">) => `/article/${leadOf(story).articleId}`;

/** CDNs an outlet serves its photos from under another name. */
const PHOTO_HOSTS: Record<string, string[]> = { "dn.pt": ["assettype.com"] };

const mainLabel = (domain: string) =>
  domain
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")[0] ?? "";

/** Whether a photo's address is the outlet's own: its name in the host ("media-manager.noticiasaominuto.com"), or a known CDN. */
export function isOutletPhoto(url: string, domain: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const site = domain.toLowerCase().replace(/^www\./, "");
  const label = mainLabel(site);
  if (label.length >= 3 && host.includes(label)) return true;
  // "img.iol.pt" for "cnnportugal.iol.pt": the same site, unless it's a shared one such as sapo.pt.
  const base = (name: string) => name.split(".").slice(-2).join(".");
  if (base(host) === base(site) && base(site) !== "sapo.pt") return true;
  return (PHOTO_HOSTS[site] ?? []).some((cdn) => host === cdn || host.endsWith(`.${cdn}`));
}

/**
 * The photo for a story's card, and whose it is (the outlet's name as the API gives it, for "Imagem · …"). The lead
 * outlet's own when there is one; otherwise another outlet's, credited to it, rather than an empty frame. Null credit:
 * the outlet can't be told. Null: no outlet has a photo.
 */
export function storyPhoto(story: Pick<Story, "title" | "versions" | "imageUrl">): { url: string; credit: string | null } | null {
  const lead = leadOf(story);
  // With a photo per outlet (when the API sends them): the lead's, else the first outlet's that has one.
  if (story.versions.some((version) => version.imageUrl !== undefined)) {
    const own = [lead, ...story.versions].find((version) => version.imageUrl);
    return own?.imageUrl ? { url: own.imageUrl, credit: own.source } : null;
  }
  if (!story.imageUrl) return null;
  if (story.versions.length <= 1) return { url: story.imageUrl, credit: lead.source };
  const url = story.imageUrl;
  const owner = [lead, ...story.versions].find((version) => isOutletPhoto(url, version.sourceDomain));
  return { url, credit: owner?.source ?? null };
}

/**
 * A story's later pieces («Desenvolvimentos»): every article that isn't its outlet's first, newest first. An outlet's
 * first is its chip and its headline in «como cada jornal contou»; GET /stories/:id sends every article.
 */
export function laterPieces(story: Pick<StoryDetail, "articles">): Article[] {
  const oldestFirst = [...story.articles].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  const seen = new Set<string>();
  const later = oldestFirst.filter((article) => {
    const outlet = article.sourceDomain || article.source;
    if (seen.has(outlet)) return true;
    seen.add(outlet);
    return false;
  });
  return later.reverse();
}

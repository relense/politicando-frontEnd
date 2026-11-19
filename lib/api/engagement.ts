import { z } from "zod";
import { request } from "./client";

/*
 * What brings readers back (backend docs/engagement-api.md): the inbox, "Seguir", "Passa na próxima votação?" and the
 * saved page. Private to the account: no karma, no public profiles, no leaderboards. Everything but the open
 * predictions list needs the session, so it goes through the site's own server (request() sends /me and /predictions
 * there from the browser) and is never cached.
 */

const noStore = { cache: "no-store" as const };
const json = (method: string, body?: unknown) => ({
  method,
  cache: "no-store" as const,
  headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const nullableId = z.number().nullable().catch(null);
const nullableText = z.string().nullable().catch(null);

// ── Inbox ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_KINDS = ["comment_reply", "forum_reply", "thread_update", "story_update", "prediction_result"] as const;

export const notificationSchema = z.object({
  id: z.number(),
  kind: z.string(),
  actorName: nullableText,
  count: z.number().catch(1),
  createdAt: z.string(),
  read: z.boolean().catch(false),
  snippet: nullableText,
  link: z
    .object({
      commentId: nullableId,
      articleId: nullableId,
      storyId: nullableId,
      postSlug: nullableText,
      threadId: nullableId,
      postId: nullableId,
      initiativeId: nullableId,
    })
    .catch({ commentId: null, articleId: null, storyId: null, postSlug: null, threadId: null, postId: null, initiativeId: null }),
  threadTitle: nullableText,
  board: nullableText,
  headline: nullableText,
  prediction: z
    .object({
      initiativeTitle: z.string(),
      pick: z.enum(["pass", "fail"]),
      outcome: z.enum(["hit", "miss", "void"]).nullable(),
      result: z.string().nullable(),
    })
    .nullable()
    .catch(null),
});
export type Notification = z.infer<typeof notificationSchema>;

const notificationPageSchema = z.object({ items: z.array(notificationSchema), nextCursor: z.string().nullable().catch(null) });

export const getNotifications = (cursor?: string | null) =>
  request(`/me/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, notificationPageSchema, noStore);
export const getUnreadCount = async () => (await request("/me/notifications/unread", z.object({ count: z.number() }), noStore)).count;
/** Those lines read, or all of them without ids. */
export const markNotificationsRead = (ids?: number[]) => request("/me/notifications/read", z.unknown(), json("POST", ids ? { ids } : {}));

// ── Seguir ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type FollowKind = "story" | "thread";
export const setFollow = (kind: FollowKind, id: number, on: boolean) =>
  request(`/me/follows/${kind}/${id}`, z.unknown(), json(on ? "PUT" : "DELETE"));

// ── Passa na próxima votação? ───────────────────────────────────────────────────────────────────────────────────────

export type Pick = "pass" | "fail";
const splitSchema = z.object({ pass: z.number(), fail: z.number() });
export type Split = z.infer<typeof splitSchema>;

const optionalText = nullableText.optional().transform((value) => value ?? null);
const topicsSchema = z.array(z.object({ slug: z.string(), label: z.string() })).catch([]);
const plainSchema = z
  .object({ title: nullableText, typeLabel: nullableText, typeExplainer: nullableText })
  .nullable()
  .optional()
  .catch(null)
  .transform((value) => value ?? null);

const optionalNumber = z
  .number()
  .nullable()
  .optional()
  .catch(null)
  .transform((value) => value ?? null);
const groupsSchema = z.array(z.object({ party: z.string(), count: optionalNumber })).catch([]);
/** How the groups voted (parliament records votes by group, not deputy totals). Null unless decided by a vote. */
const tallySchema = z
  .object({ unanimous: z.boolean().catch(false), favor: groupsSchema, against: groupsSchema, abstention: groupsSchema })
  .nullable()
  .optional()
  .catch(null)
  .transform((value) => value ?? null);
export type Tally = NonNullable<z.infer<typeof tallySchema>>;

/**
 * A vote's "Passa ou chumba?", in any state (backend docs/engagement-api.md):
 * - upcoming: on the agenda, picks open at opensAt (a week before the session); no thread yet;
 * - open: until closesAt (the session starts); the split only once this reader has picked;
 * - closed: the session started; the split for everyone;
 * - decided: settled; voteResult null when decided without a vote.
 * `count` is how many picked, the number only. `voteLabel` is what gets voted ("votação na generalidade"); `phase` is
 * only the latest step and is never shown as the vote. `author`: "Governo", a regional assembly or the signing parties.
 */
export const predictionSchema = z.object({
  id: z.number(),
  type: z.string().catch(""),
  number: optionalText,
  title: z.string(),
  plain: plainSchema,
  topics: topicsSchema.optional().transform((value) => value ?? []),
  phase: optionalText,
  phaseDate: optionalText,
  state: z.enum(["upcoming", "open", "closed", "decided"]).catch("open"),
  opensAt: optionalText,
  closesAt: optionalText,
  count: z
    .number()
    .nullable()
    .optional()
    .catch(null)
    .transform((value) => value ?? null),
  voteLabel: optionalText,
  author: optionalText,
  replyCount: optionalNumber,
  tally: tallySchema,
  threadId: optionalNumber,
  myPick: z
    .enum(["pass", "fail"])
    .nullable()
    .optional()
    .catch(null)
    .transform((value) => value ?? null),
  split: splitSchema
    .nullable()
    .optional()
    .catch(null)
    .transform((value) => value ?? null),
  voteDate: optionalText,
  voteResult: optionalText,
  outcome: z
    .enum(["hit", "miss", "void"])
    .nullable()
    .optional()
    .catch(null)
    .transform((value) => value ?? null),
});
export type Prediction = z.infer<typeof predictionSchema>;
/** The initiative page's box is the same thing. */
export type InitiativePrediction = Prediction;

const openSchema = z.object({ items: z.array(predictionSchema) });

/**
 * The week's votes: open first (soonest session first); with `upcoming`, then those whose picks open within the week.
 * On the server, cached and anonymous (no picks); in the browser, with the reader's own picks.
 */
export const getOpenPredictions = async (
  limit = 10,
  init?: RequestInit & { next?: { revalidate?: number } },
  { upcoming = false }: { upcoming?: boolean } = {},
) => (await request(`/predictions/open?limit=${limit}${upcoming ? "&upcoming=true" : ""}`, openSchema, init ?? noStore)).items;

export const pickPrediction = (id: number, pick: Pick) =>
  request(`/predictions/${id}`, z.object({ pick: z.enum(["pass", "fail"]), split: splitSchema }), json("PUT", { pick }));
export const unpickPrediction = (id: number) => request(`/predictions/${id}`, z.unknown(), json("DELETE"));

/** One initiative's (GET /predictions/:initiativeId; 404 when it has none). At most one poll per initiative, kept forever. */
export const getInitiativePrediction = (id: number) => request(`/predictions/${id}`, predictionSchema, noStore);

export const myPredictionsSchema = z.object({
  record: z.object({ hits: z.number(), misses: z.number(), pending: z.number(), streak: z.number() }),
  items: z.array(
    z.object({
      initiativeId: z.number(),
      title: z.string(),
      pick: z.enum(["pass", "fail"]),
      outcome: z.enum(["hit", "miss", "void"]).nullable(),
      voteDate: nullableText,
      voteResult: nullableText,
      updatedAt: z.string(),
      split: splitSchema.nullable().catch(null),
      topics: topicsSchema.optional().transform((value) => value ?? []),
      tally: tallySchema,
    }),
  ),
});
export type MyPredictions = z.infer<typeof myPredictionsSchema>;
export const getMyPredictions = () => request("/me/predictions", myPredictionsSchema, noStore);

// ── Guardados ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** What can be saved beyond news and stories, only with an account (`PUT /me/saved/:kind/:id`). */
export type SaveKind = "editorial" | "comment" | "thread" | "reply";
export const setSaved = (kind: SaveKind | "article" | "story", id: number, on: boolean) =>
  request(`/me/saved/${kind}/${id}`, z.unknown(), json(on ? "PUT" : "DELETE"));

const savedAt = { savedAt: z.string() };
export const savedPageSchema = z.object({
  editorial: z
    .array(
      z.object({
        ...savedAt,
        id: z.number(),
        slug: z.string(),
        kind: z.string(),
        title: z.string(),
        subtitle: nullableText,
        coverImageUrl: nullableText,
        publishedAt: z.string(),
      }),
    )
    .catch([]),
  comments: z
    .array(
      z.object({
        ...savedAt,
        id: z.number(),
        body: z.string(),
        username: nullableText,
        likes: z.number().catch(0),
        createdAt: z.string(),
        articleId: nullableId,
        storyId: nullableId,
        postSlug: nullableText,
      }),
    )
    .catch([]),
  threads: z
    .array(
      z.object({
        ...savedAt,
        id: z.number(),
        board: z.string(),
        title: z.string(),
        nickname: nullableText,
        score: z.number().catch(0),
        replyCount: z.number().catch(0),
        createdAt: z.string(),
      }),
    )
    .catch([]),
  replies: z
    .array(
      z.object({
        ...savedAt,
        id: z.number(),
        threadId: z.number(),
        threadTitle: z.string(),
        board: z.string(),
        body: z.string(),
        nickname: nullableText,
        createdAt: z.string(),
      }),
    )
    .catch([]),
});
export type SavedPage = z.infer<typeof savedPageSchema>;
export const getSavedPage = () => request("/me/saved", savedPageSchema, noStore);

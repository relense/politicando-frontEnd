import { z } from "zod";

export const partySchema = z.object({
  slug: z.string(),
  acronym: z.string(),
  name: z.string(),
  website: z.string().nullable(),
});

const articlePartySchema = partySchema.pick({ slug: true, acronym: true, name: true });

export const articleSchema = z.object({
  id: z.number(),
  title: z.string(),
  excerpt: z.string(),
  url: z.string(),
  source: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string(),
  commentCount: z.number(),
  parties: z.array(articlePartySchema),
});

export const articlePageSchema = z.object({
  items: z.array(articleSchema),
  nextCursor: z.string().nullable(),
});

export const commentSchema = z.object({
  id: z.number(),
  parentId: z.number().nullable(),
  username: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
});

const statusSchema = z.enum(["approved", "in_progress", "rejected", "withdrawn"]);
// Optional extras default to empty, so a missing detail never takes the whole page down.
const list = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((value) => value ?? []);

export const deputySummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  group: z.string(),
  party: z.string().nullable(),
  constituency: z.string(),
  seat: z.number().nullish(),
  parliamentRole: z.string().nullish(),
  photoUrl: z.string().nullish(),
});

export const parliamentSchema = z.object({
  legislature: z.string(),
  updatedAt: z.string().nullable(),
  seatMap: z.object({
    source: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    seats: z.array(
      z.object({ number: z.number(), group: z.string(), party: z.string(), x: z.number(), y: z.number(), deputyId: z.number().nullish() }),
    ),
  }),
  groups: z.array(z.object({ group: z.string(), party: articlePartySchema, seats: z.number() })),
  deputies: z.array(deputySummarySchema),
  initiativeCounts: z.record(z.string(), z.number()).nullish(),
});

export const initiativeSchema = z.object({
  id: z.number(),
  type: z.string(),
  number: z.string().nullish(),
  title: z.string(),
  status: statusSchema,
  phase: z.string().nullish(),
  phaseDate: z.string().nullish(),
  submittedAt: z.string().nullish(),
  publishedAt: z.string().nullish(),
  textUrl: z.string().nullish(),
  authors: z.object({
    parties: list(articlePartySchema),
    deputies: list(z.object({ id: z.number(), name: z.string(), party: z.string().nullable() })),
    other: z.string().nullish(),
  }),
  lastVote: z.object({ date: z.string().nullish(), phase: z.string().nullish(), result: z.string(), unanimous: z.boolean() }).nullish(),
});

const positionSchema = z.object({ party: z.string(), count: z.number().nullable() });

export const initiativeDetailSchema = initiativeSchema.extend({
  votes: list(
    z.object({
      id: z.string(),
      date: z.string().nullish(),
      phase: z.string().nullish(),
      result: z.string(),
      unanimous: z.boolean(),
      favor: list(positionSchema),
      against: list(positionSchema),
      abstention: list(positionSchema),
      named: list(z.object({ name: z.string(), group: z.string(), position: z.string() })),
    }),
  ),
});

export const initiativePageSchema = z.object({
  items: z.array(initiativeSchema),
  nextCursor: z.string().nullable(),
});

export const deputyDetailSchema = deputySummarySchema.extend({
  fullName: z.string(),
  partyInfo: articlePartySchema.nullish(),
  situation: z.string().nullish(),
  active: z.boolean(),
  birthDate: z.string().nullish(),
  profession: z.string().nullish(),
  education: list(z.object({ course: z.string(), completed: z.boolean() })),
  roles: list(z.object({ title: z.string(), current: z.boolean() })),
  committees: list(
    z.object({ name: z.string(), acronym: z.string().nullish(), membership: z.string().nullish(), role: z.string().nullish() }),
  ),
  pastLegislatures: list(z.string()),
  initiatives: z.object({ total: z.number(), approved: z.number(), latest: list(initiativeSchema) }),
  articles: list(articleSchema),
});

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type ApiParty = z.infer<typeof partySchema>;
export type ApiArticle = z.infer<typeof articleSchema>;
export type ApiComment = z.infer<typeof commentSchema>;
export type ApiDeputySummary = z.infer<typeof deputySummarySchema>;
export type ApiDeputyDetail = z.infer<typeof deputyDetailSchema>;
export type ApiParliament = z.infer<typeof parliamentSchema>;
export type ApiInitiative = z.infer<typeof initiativeSchema>;
export type ApiInitiativeDetail = z.infer<typeof initiativeDetailSchema>;
/** What the API sends, before defaults are applied. Used by the mock API. */
export type ApiParliamentInput = z.input<typeof parliamentSchema>;
export type ApiInitiativeInput = z.input<typeof initiativeSchema>;
export type ApiInitiativeDetailInput = z.input<typeof initiativeDetailSchema>;
export type ApiDeputyDetailInput = z.input<typeof deputyDetailSchema>;

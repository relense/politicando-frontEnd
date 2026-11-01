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

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type ApiParty = z.infer<typeof partySchema>;
export type ApiArticle = z.infer<typeof articleSchema>;
export type ApiComment = z.infer<typeof commentSchema>;

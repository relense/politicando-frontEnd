import { z } from "zod";
import type { Article, Initiative, InitiativeTopic } from "@/lib/types";
import { cached, hourly, request } from "./client";
import { mapArticle, mapInitiative, safeHttpUrl } from "./mappers";
import { articleSchema, initiativeSchema } from "./schemas";

const many = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((value) => value ?? []);

export const presidencySchema = z.object({
  president: z.object({
    id: z.string(),
    name: z.string(),
    fullName: z.string().nullish(),
    termStart: z.string(),
    bio: many(z.string()),
    photoUrl: z.string().nullish(),
    url: z.string().nullish(),
  }),
  legislation: z.object({
    promulgated: z.number(),
    vetoed: z.number(),
    pending: z.number(),
    latestVetoes: many(initiativeSchema),
    latestPromulgated: many(initiativeSchema),
    pendingNow: many(initiativeSchema),
  }),
  articles: many(articleSchema),
  former: many(z.object({ id: z.string(), name: z.string(), termStart: z.string(), termEnd: z.string().nullish() })),
});

export type ApiPresidencyInput = z.input<typeof presidencySchema>;

export type President = {
  id: string;
  name: string;
  fullName: string;
  termStart: string;
  /** The official biography, one paragraph each, as plain text. */
  bio: string[];
  /** Only https photos, which the image optimiser accepts. */
  photoUrl: string | null;
  url: string | null;
};

export type Presidency = {
  president: President;
  /** Parliament decrees during this term only. */
  legislation: {
    promulgated: number;
    /** Includes laws Parliament later passed again. */
    vetoed: number;
    pending: number;
    latestVetoes: Initiative[];
    latestPromulgated: Initiative[];
    pendingNow: Initiative[];
  };
  articles: Article[];
  former: { id: string; name: string; termStart: string; termEnd: string | null }[];
};

export function mapPresidency(data: z.infer<typeof presidencySchema>): Presidency {
  const { president, legislation } = data;
  const photo = safeHttpUrl(president.photoUrl);
  return {
    president: {
      id: president.id,
      name: president.name,
      fullName: president.fullName ?? president.name,
      termStart: president.termStart,
      bio: president.bio.map((paragraph) => paragraph.trim()).filter(Boolean),
      photoUrl: photo?.startsWith("https://") ? photo : null,
      url: safeHttpUrl(president.url),
    },
    legislation: {
      promulgated: legislation.promulgated,
      vetoed: legislation.vetoed,
      pending: legislation.pending,
      latestVetoes: legislation.latestVetoes.map(mapInitiative),
      latestPromulgated: legislation.latestPromulgated.map(mapInitiative),
      pendingNow: legislation.pendingNow.map(mapInitiative),
    },
    articles: data.articles.map(mapArticle),
    former: data.former.map((item) => ({ ...item, termEnd: item.termEnd ?? null })),
  };
}

/** The President of the Republic, what they did with Parliament's laws, and the news about them. */
export async function getPresidency(): Promise<Presidency> {
  return mapPresidency(await request("/president", presidencySchema, cached));
}

const topicsSchema = z.object({
  items: z.array(z.object({ slug: z.string(), label: z.string(), count: z.number() })),
  untagged: z.number().nullish(),
});

export type TopicCount = InitiativeTopic & { count: number };

/** The subjects initiatives are tagged with, in a fixed order, with how many each has. */
export async function getInitiativeTopics(): Promise<{ items: TopicCount[]; untagged: number }> {
  const data = await request("/initiatives/topics", topicsSchema, hourly);
  return { items: data.items, untagged: data.untagged ?? 0 };
}

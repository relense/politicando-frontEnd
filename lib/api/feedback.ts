import { z } from "zod";
import { ApiError, request, searchOf } from "./client";
import { safeHttpUrl } from "./mappers";

/** Readers' feedback, the public log of corrections and the ideas they vote on (contract in docs/api-handoff.md, "Feedback"). */

export const FEEDBACK_KINDS = ["error", "idea", "broken", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export type NewFeedback = {
  kind: FeedbackKind;
  /** The section, as the reader chose it ("Percursos"). */
  page: string | null;
  url: string | null;
  message: string;
  /** For an error: what is right, and where it can be confirmed. */
  correction: string | null;
  source: string | null;
  /** Only when the reader asked to be told; used for nothing else. */
  email: string | null;
  screenshot: File | null;
  captchaToken: string;
};

export type CorrectionStatus = "fixed" | "checking" | "rejected";

export type Correction = { id: string; status: CorrectionStatus; date: string; area: string | null; title: string; url: string | null };

export type IdeaStatus = "reviewing" | "planned" | "in_progress" | "done";

export type Idea = { id: string; title: string; votes: number; status: IdeaStatus };

export type FeedbackSummary = {
  /** Median days from a message to its first answer, over the last 90 days; null with too few. */
  responseDays: number | null;
  correctionsThisMonth: number;
  corrections: Correction[];
  ideas: Idea[];
};

const correctionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  status: z.string(),
  date: z.string(),
  area: z.string().nullish(),
  title: z.string(),
  url: z.string().nullish(),
});

const ideaSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  votes: z.number(),
  status: z.string().nullish(),
});

const summarySchema = z.object({
  stats: z.object({ responseDays: z.number().nullish(), correctionsThisMonth: z.number().default(0) }).default({ correctionsThisMonth: 0 }),
  corrections: z.array(correctionSchema).default([]),
  ideas: z.array(ideaSchema).default([]),
});

const mapCorrection = (raw: z.infer<typeof correctionSchema>): Correction => ({
  id: raw.id,
  status: raw.status === "fixed" || raw.status === "rejected" ? raw.status : "checking",
  date: raw.date,
  area: raw.area ?? null,
  title: raw.title,
  // Only links on this site or elsewhere over http(s).
  url: raw.url?.startsWith("/") && !raw.url.startsWith("//") ? raw.url : safeHttpUrl(raw.url ?? null),
});

const IDEA_STATUSES: IdeaStatus[] = ["reviewing", "planned", "in_progress", "done"];

export const mapIdea = (raw: z.infer<typeof ideaSchema>): Idea => ({
  id: raw.id,
  title: raw.title,
  votes: raw.votes,
  status: IDEA_STATUSES.find((status) => status === raw.status) ?? "reviewing",
});

/** The side of the feedback page; null while the API has none. */
export async function getFeedbackSummary(): Promise<FeedbackSummary | null> {
  try {
    const data = await request("/feedback/summary", summarySchema, { next: { revalidate: 300 } });
    return {
      responseDays: data.stats.responseDays ?? null,
      correctionsThisMonth: data.stats.correctionsThisMonth,
      corrections: data.corrections.map(mapCorrection),
      ideas: data.ideas.map(mapIdea),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The whole log of corrections, newest first; null while the API has none. */
export async function getCorrections(cursor?: string): Promise<{ items: Correction[]; nextCursor: string | null } | null> {
  try {
    const data = await request(
      `/corrections${searchOf({ cursor, limit: 50 })}`,
      z.object({ items: z.array(correctionSchema), nextCursor: z.string().nullish() }),
      { next: { revalidate: 300 } },
    );
    return { items: data.items.map(mapCorrection), nextCursor: data.nextCursor ?? null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Sent as a form, so a screenshot can go with it. */
export async function sendFeedback(input: NewFeedback): Promise<void> {
  const form = new FormData();
  form.set("kind", input.kind);
  for (const [key, value] of Object.entries({
    page: input.page,
    url: input.url,
    message: input.message,
    correction: input.correction,
    source: input.source,
    email: input.email,
  })) {
    if (value) form.set(key, value);
  }
  if (input.screenshot) form.set("screenshot", input.screenshot);
  form.set("recaptchaToken", input.captchaToken);
  await request("/feedback", z.object({ id: z.union([z.string(), z.number()]) }), { method: "POST", body: form });
}

/** One vote per idea per reader; the API answers with the new count. */
export async function voteIdea(id: string): Promise<number> {
  const data = await request(`/ideas/${encodeURIComponent(id)}/vote`, z.object({ votes: z.number() }), { method: "POST" });
  return data.votes;
}

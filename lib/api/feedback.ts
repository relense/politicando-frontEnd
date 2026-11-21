import { z } from "zod";
import { ApiError, request, searchOf } from "./client";
import { isSitePath, safeHttpUrl } from "./mappers";

/** Readers' feedback and the public log of corrections (contract: docs/feedback-api.md in the backend repo). Ideas live on the forum's ideas board. */

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

export type FeedbackSummary = {
  /** Median days from a message to its first answer, over the last 90 days; null with too few. */
  responseDays: number | null;
  correctionsThisMonth: number;
  corrections: Correction[];
};

const correctionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  status: z.string(),
  date: z.string(),
  area: z.string().nullish(),
  title: z.string(),
  url: z.string().nullish(),
});

const summarySchema = z.object({
  stats: z.object({ responseDays: z.number().nullish(), correctionsThisMonth: z.number().default(0) }).default({ correctionsThisMonth: 0 }),
  corrections: z.array(correctionSchema).default([]),
});

const mapCorrection = (raw: z.infer<typeof correctionSchema>): Correction => ({
  id: raw.id,
  status: raw.status === "fixed" || raw.status === "rejected" ? raw.status : "checking",
  date: raw.date,
  area: raw.area ?? null,
  title: raw.title,
  // Only links on this site or elsewhere over http(s).
  url: isSitePath(raw.url) ? raw.url : safeHttpUrl(raw.url ?? null),
});

/** The side of the feedback page; null while the API has none. */
export async function getFeedbackSummary(): Promise<FeedbackSummary | null> {
  try {
    const data = await request("/feedback/summary", summarySchema, { next: { revalidate: 300 } });
    return {
      responseDays: data.stats.responseDays ?? null,
      correctionsThisMonth: data.stats.correctionsThisMonth,
      corrections: data.corrections.map(mapCorrection),
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

/**
 * Sent as a form, so a screenshot can go with it, from the browser with the reader's session (a signed-in reader's message is
 * tied to their account). Answers with the private follow-up token, shown once; null from an older API.
 */
export async function sendFeedback(input: NewFeedback): Promise<{ followUpToken: string | null }> {
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
  const sent = await request(
    "/feedback",
    z.object({ id: z.union([z.string(), z.number()]), followUpToken: z.string().min(1).nullish().catch(null) }),
    { method: "POST", body: form },
  );
  return { followUpToken: sent.followUpToken ?? null };
}

const followSchema = z.object({
  kind: z.string(),
  page: z.string().nullish().catch(null),
  createdAt: z.string(),
  status: z.enum(["open", "answered"]).catch("open"),
  reply: z.string().nullish().catch(null),
  answeredAt: z.string().nullish().catch(null),
});
export type FollowUp = {
  kind: string;
  page: string | null;
  createdAt: string;
  status: "open" | "answered";
  reply: string | null;
  answeredAt: string | null;
};

/** A message's status and the team's answer, from its private link. "closed": closed (its token is gone then) or never was. */
export async function getFollowUp(token: string): Promise<FollowUp | "closed"> {
  try {
    const data = await request(`/feedback/follow/${encodeURIComponent(token)}`, followSchema, { cache: "no-store" });
    return { ...data, page: data.page ?? null, reply: data.reply ?? null, answeredAt: data.answeredAt ?? null };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return "closed";
    throw error;
  }
}

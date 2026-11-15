import { z } from "zod";
import { cached, request } from "./client";

/** How a party's group voted in this legislature: totals and how often it voted with each other party. */
const summarySchema = z.object({
  legislature: z.string().nullish(),
  summary: z.object({
    total: z.number(),
    favor: z.number(),
    against: z.number(),
    abstention: z.number(),
    absent: z.number().nullish(),
    split: z.number().nullish(),
  }),
  agreement: z.array(
    z.object({ party: z.object({ slug: z.string(), acronym: z.string() }), compared: z.number(), pct: z.number().nullable() }),
  ),
});

export type ApiPartyVoteSummaryInput = z.input<typeof summarySchema> & { items?: unknown[]; total?: number };

export type PartyVoteSummary = {
  legislature: string | null;
  total: number;
  favor: number;
  against: number;
  abstention: number;
  /** Votes where part of the group voted otherwise. */
  split: number;
  /** Other parties with seats, most aligned first; only those with something to compare. */
  agreement: { slug: string; acronym: string; pct: number }[];
};

export function mapPartyVoteSummary(raw: z.infer<typeof summarySchema>): PartyVoteSummary {
  return {
    legislature: raw.legislature ?? null,
    total: raw.summary.total,
    favor: raw.summary.favor,
    against: raw.summary.against,
    abstention: raw.summary.abstention,
    split: raw.summary.split ?? 0,
    agreement: raw.agreement
      .filter((item): item is typeof item & { pct: number } => item.pct !== null && item.compared > 0)
      .map((item) => ({ slug: item.party.slug, acronym: item.party.acronym, pct: item.pct }))
      .sort((a, b) => b.pct - a.pct),
  };
}

/** Null when the party has no votes recorded (or the API can't say), so the block is left out. */
export async function getPartyVoteSummary(slug: string): Promise<PartyVoteSummary | null> {
  try {
    const summary = mapPartyVoteSummary(await request(`/parties/${encodeURIComponent(slug)}/votes?limit=1`, summarySchema, cached));
    return summary.total > 0 ? summary : null;
  } catch {
    return null;
  }
}

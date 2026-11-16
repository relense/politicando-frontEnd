import { z } from "zod";
import type { Initiative } from "@/lib/types";
import { cached, request } from "./client";
import { mapInitiative } from "./mappers";
import { initiativeSchema } from "./schemas";

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

export type PartyVotePosition = "favor" | "against" | "abstention";
/** What the list can be filtered by: a position, or the votes where the group split. */
export type PartyVoteFilter = PartyVotePosition | "split";

export type PartyVote = {
  initiative: Initiative;
  vote: { id: string; date: string | null; phase: string | null; result: string | null; unanimous: boolean };
  /** What the group as a whole did; null when it isn't in the record. */
  position: PartyVotePosition | null;
  /** Part of the group voted otherwise. */
  split: boolean;
  basis: "group" | "unanimous" | "absent" | "unknown";
};

const listSchema = z.object({
  items: z.array(
    z.object({
      initiative: initiativeSchema,
      vote: z.object({
        id: z.union([z.string(), z.number()]).transform(String),
        date: z.string().nullish(),
        phase: z.string().nullish(),
        result: z.string().nullish(),
        unanimous: z.boolean().nullish(),
      }),
      position: z.enum(["favor", "against", "abstention"]).nullish().catch(null),
      split: z.boolean().nullish(),
      basis: z.enum(["group", "unanimous", "absent", "unknown"]).catch("unknown"),
    }),
  ),
  total: z.number(),
});

export type ApiPartyVoteListInput = z.input<typeof listSchema>;

/** One page of the party's votes, newest first; the API pages by number and says how many match. */
export async function getPartyVotes(
  slug: string,
  { filter, page = 1, limit = 20 }: { filter?: PartyVoteFilter | null; page?: number; limit?: number } = {},
): Promise<{ votes: PartyVote[]; total: number; page: number; pages: number }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter) query.set("position", filter);
  const raw = await request(`/parties/${encodeURIComponent(slug)}/votes?${query}`, listSchema);
  return {
    votes: raw.items.map((item) => ({
      initiative: mapInitiative(item.initiative),
      vote: {
        id: item.vote.id,
        date: item.vote.date ?? null,
        phase: item.vote.phase ?? null,
        result: item.vote.result ?? null,
        unanimous: item.vote.unanimous ?? false,
      },
      position: item.position ?? null,
      split: item.split ?? false,
      basis: item.basis,
    })),
    total: raw.total,
    page,
    pages: Math.max(1, Math.ceil(raw.total / limit)),
  };
}

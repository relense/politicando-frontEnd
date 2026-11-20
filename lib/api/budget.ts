import { z } from "zod";
import type { Vote } from "@/lib/types";
import { ApiError, cached, request, searchOf } from "./client";
import { safeHttpUrl } from "./mappers";

/**
 * The State Budget: every amendment proposal and how each party voted on it, plus each year's own bill (contract:
 * docs/budget-api.md in the backend repo). Only the parliament's data, in its own terms; tolerant of what an older or
 * newer API sends (an unknown result reads "unclear", an unknown vote reads as unknown, never guessed).
 */

export const BUDGET_RESULTS = [
  "pending",
  "sent_to_plenary",
  "approved",
  "partially_approved",
  "rejected",
  "withdrawn",
  "not_admitted",
  "superseded",
  "unclear",
] as const;
export type BudgetResult = (typeof BUDGET_RESULTS)[number];
/** Everything still waiting for a vote, the plenary's included. */
export const STILL_TO_VOTE: BudgetResult[] = ["pending", "sent_to_plenary"];

export const BUDGET_CHOICES = ["favor", "against", "abstention", "absent"] as const;
export type BudgetChoice = (typeof BUDGET_CHOICES)[number];

export type BudgetParty = { slug: string; acronym: string; name: string };
/** One line of a vote: a group's, or a deputy voting apart (`deputy` set). `party` null: an independent, or a group nobody recognised. */
export type BudgetLine = { party: BudgetParty | null; group: string; deputy: string | null; vote: BudgetChoice | null };
export type BudgetVote = {
  votedOn: string | null;
  phase: "committee" | "plenary" | null;
  result: "approved" | "rejected" | "superseded" | null;
  unanimous: boolean;
  label: string | null;
  partLabel: string | null;
  /** When voted in parts: what this part covers. */
  parts: string[];
  subject: string | null;
  parties: BudgetLine[];
  /** The source couldn't be read with certainty; `ambiguity` says why. */
  ambiguous: boolean;
  ambiguity: string | null;
};
export type BudgetProposal = {
  id: number;
  year: number;
  number: string;
  title: string;
  article: string | null;
  topics: string[];
  target: string | null;
  kind: string | null;
  /** The source's own words. */
  status: string | null;
  result: BudgetResult;
  resultPhase: "committee" | "plenary" | null;
  unanimous: boolean;
  authors: { parties: BudgetParty[]; deputies: string[]; label: string | null };
  submittedOn: string | null;
  lastVotedOn: string | null;
  /** «O que muda», one or two sentences; `automatic` when a model wrote it from the PDF. Null until written. */
  plain: { summary: string; automatic: boolean; updatedAt: string | null } | null;
  documentUrl: string | null;
  sourceUrl: string | null;
  votes: BudgetVote[];
};
/** The Budget's own bill: its votes have the shape of an initiative's (generalidade, votação final global…). */
export type BudgetBill = {
  initiativeId: number | null;
  legislature: string | null;
  number: string | null;
  title: string;
  status: string;
  votes: Vote[];
};
export type BudgetYear = {
  year: number;
  proposals: number;
  voted: number;
  pending: number;
  lastVotedOn: string | null;
  syncedAt: string | null;
  bills: BudgetBill[];
};
export type BudgetSessionStage = "committee" | "plenary" | "general_vote" | "final_vote";
/**
 * A Budget voting session from the parliament's agenda. `stage: "final_vote"` is the session that ends with the final
 * overall vote. `started` is the API's word that it began (null from an older API); `endsAt` is almost always null.
 */
export type BudgetSession = {
  id: string;
  title: string;
  kind: string;
  stage: BudgetSessionStage | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  started: boolean | null;
};
export type BudgetPartySummary = {
  party: BudgetParty;
  proposals: number;
  results: Partial<Record<BudgetResult, number>>;
  votesOnOthers: Record<BudgetChoice, number>;
};
export type BudgetSummary = {
  year: number;
  votedFrom: string | null;
  votedTo: string | null;
  proposals: number;
  votes: number;
  ambiguousVotes: number;
  results: Partial<Record<BudgetResult, number>>;
  parties: BudgetPartySummary[];
  topics: { topic: string; proposals: number }[];
  lastVotedOn: string | null;
  syncedAt: string | null;
  bills: BudgetBill[];
  /** The Budget voting sessions to come (from the agenda); empty once all is voted and on a day's summary. */
  schedule: BudgetSession[];
  sourceUrl: string | null;
};

const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((items) => items ?? []);
const partySchema = z.object({ slug: z.string(), acronym: z.string().nullish(), name: z.string().nullish() });
const lineSchema = z.object({
  party: partySchema.nullish(),
  group: z.string().nullish(),
  deputy: z.string().nullish(),
  vote: z.string().nullish(),
});
const voteSchema = z.object({
  votedOn: z.string().nullish(),
  phase: z.string().nullish(),
  result: z.string().nullish(),
  unanimous: z.boolean().nullish(),
  label: z.string().nullish(),
  partLabel: z.string().nullish(),
  parts: list(z.string()),
  subject: z.string().nullish(),
  parties: list(lineSchema),
  ambiguous: z.boolean().nullish(),
  ambiguity: z.string().nullish(),
});
export const budgetProposalSchema = z.object({
  id: z.number(),
  year: z.number(),
  number: z.string().nullish(),
  title: z.string().nullish(),
  article: z.string().nullish(),
  topics: list(z.string()),
  target: z.string().nullish(),
  kind: z.string().nullish(),
  status: z.string().nullish(),
  result: z.string().nullish(),
  resultPhase: z.string().nullish(),
  unanimous: z.boolean().nullish(),
  authors: z.object({ parties: list(partySchema), deputies: list(z.string()), label: z.string().nullish() }).nullish(),
  submittedOn: z.string().nullish(),
  lastVotedOn: z.string().nullish(),
  plain: z.object({ summary: z.string().nullish(), automatic: z.boolean().nullish(), updatedAt: z.string().nullish() }).nullish(),
  documentUrl: z.string().nullish(),
  sourceUrl: z.string().nullish(),
  votes: list(voteSchema),
});
const positionSchema = z.object({ party: z.string(), count: z.number().nullish() });
const absentSchema = z.union([positionSchema, z.string().transform((party) => ({ party, count: null }))]);
const billSchema = z.object({
  initiativeId: z.number().nullish(),
  legislature: z.string().nullish(),
  number: z.string().nullish(),
  title: z.string().nullish(),
  status: z.string().nullish(),
  votes: list(
    z.object({
      id: z.string().nullish(),
      date: z.string().nullish(),
      phase: z.string().nullish(),
      result: z.string().nullish(),
      unanimous: z.boolean().nullish(),
      favor: list(positionSchema),
      against: list(positionSchema),
      abstention: list(positionSchema),
      absent: list(absentSchema),
      named: list(z.object({ name: z.string(), group: z.string(), position: z.string() })),
    }),
  ),
});
const yearSchema = z.object({
  year: z.number(),
  proposals: z.number().nullish(),
  voted: z.number().nullish(),
  pending: z.number().nullish(),
  lastVotedOn: z.string().nullish(),
  syncedAt: z.string().nullish(),
  bills: list(billSchema),
});
const counts = z.record(z.string(), z.number()).nullish();
const summarySchema = z.object({
  year: z.number(),
  votedFrom: z.string().nullish(),
  votedTo: z.string().nullish(),
  proposals: z.number().nullish(),
  votes: z.number().nullish(),
  ambiguousVotes: z.number().nullish(),
  results: counts,
  parties: list(
    z.object({
      party: partySchema,
      proposals: z.number().nullish(),
      results: counts,
      votesOnOthers: z
        .object({
          favor: z.number().nullish(),
          against: z.number().nullish(),
          abstention: z.number().nullish(),
          absent: z.number().nullish(),
        })
        .nullish(),
    }),
  ),
  topics: list(z.object({ topic: z.string(), proposals: z.number() })),
  lastVotedOn: z.string().nullish(),
  syncedAt: z.string().nullish(),
  bills: list(billSchema),
  schedule: list(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      title: z.string(),
      kind: z.string().nullish(),
      stage: z.string().nullish(),
      startsAt: z.string(),
      endsAt: z.string().nullish(),
      allDay: z.boolean().nullish(),
      started: z.boolean().nullish(),
    }),
  ),
  sourceUrl: z.string().nullish(),
});

const oneOf = <T extends string>(values: readonly T[], value: string | null | undefined): T | null =>
  value && (values as readonly string[]).includes(value) ? (value as T) : null;
const phaseOf = (value: string | null | undefined) => oneOf(["committee", "plenary"] as const, value);
const mapParty = (raw: z.infer<typeof partySchema>): BudgetParty => ({
  slug: raw.slug,
  acronym: raw.acronym || raw.slug.toUpperCase(),
  name: raw.name || raw.acronym || raw.slug.toUpperCase(),
});
const mapCounts = (raw: Record<string, number> | null | undefined): Partial<Record<BudgetResult, number>> =>
  Object.fromEntries(Object.entries(raw ?? {}).filter(([key]) => (BUDGET_RESULTS as readonly string[]).includes(key)));

export function mapBudgetProposal(input: unknown): BudgetProposal {
  const raw = budgetProposalSchema.parse(input);
  return {
    id: raw.id,
    year: raw.year,
    number: raw.number ?? String(raw.id),
    title: raw.title || raw.article || `Proposta ${raw.number ?? raw.id}`,
    article: raw.article ?? null,
    topics: raw.topics,
    target: raw.target ?? null,
    kind: raw.kind ?? null,
    status: raw.status ?? null,
    result: oneOf(BUDGET_RESULTS, raw.result) ?? "unclear",
    resultPhase: phaseOf(raw.resultPhase),
    unanimous: raw.unanimous ?? false,
    authors: {
      parties: (raw.authors?.parties ?? []).map(mapParty),
      deputies: raw.authors?.deputies ?? [],
      label: raw.authors?.label ?? null,
    },
    submittedOn: raw.submittedOn ?? null,
    lastVotedOn: raw.lastVotedOn ?? null,
    plain: raw.plain?.summary?.trim()
      ? { summary: raw.plain.summary.trim(), automatic: raw.plain.automatic ?? false, updatedAt: raw.plain.updatedAt ?? null }
      : null,
    documentUrl: safeHttpUrl(raw.documentUrl ?? null),
    sourceUrl: safeHttpUrl(raw.sourceUrl ?? null),
    votes: raw.votes.map((vote) => ({
      votedOn: vote.votedOn ?? null,
      phase: phaseOf(vote.phase),
      result: oneOf(["approved", "rejected", "superseded"] as const, vote.result),
      unanimous: vote.unanimous ?? false,
      label: vote.label ?? null,
      partLabel: vote.partLabel ?? null,
      parts: vote.parts,
      subject: vote.subject ?? null,
      parties: vote.parties.map((line) => ({
        party: line.party ? mapParty(line.party) : null,
        group: line.group ?? line.party?.name ?? "",
        deputy: line.deputy ?? null,
        vote: oneOf(BUDGET_CHOICES, line.vote),
      })),
      ambiguous: vote.ambiguous ?? false,
      ambiguity: vote.ambiguity ?? null,
    })),
  };
}

function mapBill(raw: z.infer<typeof billSchema>): BudgetBill {
  const positions = (items: { party: string; count?: number | null }[]) =>
    items.map((item) => ({ partySlug: item.party, count: item.count ?? null }));
  return {
    initiativeId: raw.initiativeId ?? null,
    legislature: raw.legislature ?? null,
    number: raw.number ?? null,
    title: raw.title || "Orçamento do Estado",
    status: raw.status || "in_progress",
    votes: raw.votes.map((vote, index) => ({
      id: vote.id ?? `${vote.date ?? "sem-data"}-${index}`,
      date: vote.date ?? null,
      phase: vote.phase ?? null,
      result: vote.result ?? "",
      unanimous: vote.unanimous ?? false,
      favor: positions(vote.favor),
      against: positions(vote.against),
      abstention: positions(vote.abstention),
      absent: positions(vote.absent),
      named: vote.named,
    })),
  };
}

const mapYear = (raw: z.infer<typeof yearSchema>): BudgetYear => ({
  year: raw.year,
  proposals: raw.proposals ?? 0,
  voted: raw.voted ?? 0,
  pending: raw.pending ?? 0,
  lastVotedOn: raw.lastVotedOn ?? null,
  syncedAt: raw.syncedAt ?? null,
  bills: raw.bills.map(mapBill),
});

/** A 404 (the API doesn't have the Budget yet, or not that year) is "nothing", not an error. */
async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function getBudgets(): Promise<{ items: BudgetYear[]; sourceUrl: string | null } | null> {
  return orNull(async () => {
    const raw = await request("/budget", z.object({ items: z.array(yearSchema), sourceUrl: z.string().nullish() }), cached);
    return { items: raw.items.map(mapYear), sourceUrl: safeHttpUrl(raw.sourceUrl ?? null) };
  });
}

export type BudgetDays = { votedFrom?: string; votedTo?: string };

export function getBudgetSummary(year: number, days: BudgetDays = {}): Promise<BudgetSummary | null> {
  return orNull(async () => {
    const raw = await request(
      `/budget/${year}/summary${searchOf({ votedFrom: days.votedFrom, votedTo: days.votedTo })}`,
      summarySchema,
      cached,
    );
    return {
      year: raw.year,
      votedFrom: raw.votedFrom ?? null,
      votedTo: raw.votedTo ?? null,
      proposals: raw.proposals ?? 0,
      votes: raw.votes ?? 0,
      ambiguousVotes: raw.ambiguousVotes ?? 0,
      results: mapCounts(raw.results),
      parties: raw.parties.map((entry) => ({
        party: mapParty(entry.party),
        proposals: entry.proposals ?? 0,
        results: mapCounts(entry.results),
        votesOnOthers: {
          favor: entry.votesOnOthers?.favor ?? 0,
          against: entry.votesOnOthers?.against ?? 0,
          abstention: entry.votesOnOthers?.abstention ?? 0,
          absent: entry.votesOnOthers?.absent ?? 0,
        },
      })),
      topics: raw.topics,
      lastVotedOn: raw.lastVotedOn ?? null,
      syncedAt: raw.syncedAt ?? null,
      bills: raw.bills.map(mapBill),
      schedule: raw.schedule.map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind ?? "other",
        stage: oneOf(["committee", "plenary", "general_vote", "final_vote"] as const, item.stage),
        startsAt: item.startsAt,
        endsAt: item.endsAt ?? null,
        allDay: item.allDay ?? false,
        started: item.started ?? null,
      })),
      sourceUrl: safeHttpUrl(raw.sourceUrl ?? null),
    };
  });
}

export type BudgetQuery = BudgetDays & {
  party?: string;
  result?: BudgetResult[];
  topic?: string;
  q?: string;
  sort?: "voted" | "number";
  cursor?: string;
  limit?: number;
};
export type BudgetProposalPage = { items: BudgetProposal[]; nextCursor: string | null; total: number | null };

export async function getBudgetProposals(year: number, query: BudgetQuery = {}): Promise<BudgetProposalPage> {
  const search = searchOf({
    party: query.party,
    result: query.result?.length ? query.result.join(",") : undefined,
    topic: query.topic,
    q: query.q?.trim() || undefined,
    votedFrom: query.votedFrom,
    votedTo: query.votedTo,
    sort: query.sort,
    cursor: query.cursor,
    limit: query.limit,
  });
  const raw = await request(
    `/budget/${year}/proposals${search}`,
    z.object({ items: z.array(z.unknown()), nextCursor: z.string().nullish(), total: z.number().nullish() }),
    cached,
  );
  return { items: raw.items.map(mapBudgetProposal), nextCursor: raw.nextCursor ?? null, total: raw.total ?? null };
}

export function getBudgetProposal(year: number, id: number): Promise<BudgetProposal | null> {
  return orNull(async () => mapBudgetProposal(await request(`/budget/${year}/proposals/${id}`, z.unknown(), cached)));
}

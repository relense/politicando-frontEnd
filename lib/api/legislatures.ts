import { z } from "zod";
import type { HistoricalGovernment } from "@/lib/types";
import { ApiError, hourly, request } from "./client";
import { mapGovernmentHistory, safeHttpUrl } from "./mappers";
import { governmentHistorySchema } from "./schemas";

/**
 * The legislatures of the Assembleia da República, from the Constituent Assembly (1975) to today (docs/legislatures-api.md):
 * who was elected, who governed, what Parliament proposed, and what happened in those years, with sources.
 */

export type LegislatureSummary = {
  id: string;
  name: string;
  start: string;
  /** The day the next one first sat; null for the current one. */
  end: string | null;
  current: boolean;
  elections: string[];
  primeMinisters: string[];
  initiatives: number;
  events: number;
};

export type LegislatureSeat = { list: string; name: string; partySlugs: string[]; votes: number | null; mandates: number };

export type LegislatureElection = { id: string; name: string; date: string; totalMandates: number; seats: LegislatureSeat[] };

export type InitiativeCounts = { submitted: number; approved: number; rejected: number; withdrawn: number; pending: number };

export type LegislatureAuthor = InitiativeCounts & { key: string; name: string; partySlug: string | null };

export const EVENT_KINDS = ["law", "policy", "crisis", "controversy", "economy", "international", "society"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type LegislatureEvent = {
  date: string;
  /** Only the month or the year may be known; then the day (and month) are set to 1 and must not be shown. */
  precision: "day" | "month" | "year";
  kind: EventKind | null;
  /** A criminal case: the summary gives its legal stage as of a date, and is shown whole. */
  judicial: boolean;
  title: string;
  summary: string;
  sources: { url: string; title: string | null; publisher: string | null }[];
};

export type LegislatureCase = { id: number; title: string; status: string; statusDate: string | null; startedAt: string | null };

export type Legislature = LegislatureSummary & {
  electionResults: LegislatureElection[];
  governments: HistoricalGovernment[];
  presidents: { id: string; name: string; termStart: string; termEnd: string | null }[];
  initiativeTotals: InitiativeCounts & { laws: number; byAuthor: LegislatureAuthor[] };
  eventList: LegislatureEvent[];
  cases: LegislatureCase[];
};

const summarySchema = z.object({
  id: z.string(),
  name: z.string(),
  start: z.string(),
  end: z.string().nullable(),
  current: z.boolean().nullish(),
  elections: z.array(z.string()).default([]),
  primeMinisters: z.array(z.string()).default([]),
  initiatives: z.number().default(0),
  events: z.number().default(0),
});

const countsSchema = {
  submitted: z.number().default(0),
  approved: z.number().default(0),
  rejected: z.number().default(0),
  withdrawn: z.number().default(0),
  pending: z.number().default(0),
};

const detailSchema = summarySchema.omit({ elections: true, initiatives: true, events: true }).extend({
  elections: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        date: z.string(),
        totalMandates: z.number(),
        seats: z.array(
          z.object({
            list: z.string(),
            name: z.string().nullish(),
            partySlugs: z.array(z.string()).default([]),
            votes: z.number().nullish(),
            mandates: z.number(),
          }),
        ),
      }),
    )
    .default([]),
  governments: governmentHistorySchema.shape.items.default([]),
  presidents: z.array(z.object({ id: z.string(), name: z.string(), termStart: z.string(), termEnd: z.string().nullish() })).default([]),
  initiatives: z
    .object({
      ...countsSchema,
      laws: z.number().default(0),
      byAuthor: z.array(z.object({ key: z.string(), name: z.string(), partySlug: z.string().nullish(), ...countsSchema })).default([]),
    })
    .default({ submitted: 0, approved: 0, rejected: 0, withdrawn: 0, pending: 0, laws: 0, byAuthor: [] }),
  events: z
    .array(
      z.object({
        date: z.string(),
        precision: z.string().nullish(),
        kind: z.string().nullish(),
        judicial: z.boolean().nullish(),
        title: z.string(),
        summary: z.string().default(""),
        sources: z.array(z.object({ url: z.string(), title: z.string().nullish(), publisher: z.string().nullish() })).default([]),
      }),
    )
    .default([]),
  cases: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        status: z.string(),
        statusDate: z.string().nullish(),
        startedAt: z.string().nullish(),
      }),
    )
    .default([]),
});

const mapSummary = (item: z.infer<typeof summarySchema>): LegislatureSummary => ({
  id: item.id,
  name: item.name,
  start: item.start,
  end: item.end,
  current: item.current ?? item.end === null,
  elections: item.elections,
  primeMinisters: item.primeMinisters,
  initiatives: item.initiatives,
  events: item.events,
});

export function mapLegislature(raw: z.infer<typeof detailSchema>): Legislature {
  const precisionOf = (value: string | null | undefined): LegislatureEvent["precision"] =>
    value === "month" || value === "year" ? value : "day";
  return {
    id: raw.id,
    name: raw.name,
    start: raw.start,
    end: raw.end,
    current: raw.current ?? raw.end === null,
    elections: raw.elections.map((election) => election.id),
    primeMinisters: raw.primeMinisters,
    initiatives: raw.initiatives.submitted,
    events: raw.events.length,
    electionResults: raw.elections.map((election) => ({
      ...election,
      seats: election.seats
        .map((seat) => ({
          list: seat.list,
          name: seat.name ?? seat.list,
          partySlugs: seat.partySlugs,
          votes: seat.votes ?? null,
          mandates: seat.mandates,
        }))
        .sort((a, b) => b.mandates - a.mandates),
    })),
    governments: mapGovernmentHistory({ items: raw.governments, source: null }).governments,
    presidents: raw.presidents.map((president) => ({ ...president, termEnd: president.termEnd ?? null })),
    initiativeTotals: {
      ...raw.initiatives,
      byAuthor: raw.initiatives.byAuthor.map((author) => ({ ...author, partySlug: author.partySlug ?? null })),
    },
    eventList: raw.events
      .map((event) => ({
        date: event.date,
        precision: precisionOf(event.precision),
        kind: EVENT_KINDS.find((kind) => kind === event.kind) ?? null,
        judicial: event.judicial ?? false,
        title: event.title,
        summary: event.summary,
        // Only links we can open safely; a source without one is left out.
        sources: event.sources.flatMap((source) => {
          const url = safeHttpUrl(source.url);
          return url ? [{ url, title: source.title ?? null, publisher: source.publisher ?? null }] : [];
        }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    cases: raw.cases.map((item) => ({ ...item, statusDate: item.statusDate ?? null, startedAt: item.startedAt ?? null })),
  };
}

/** Every legislature, newest first. */
export async function getLegislatures(): Promise<LegislatureSummary[]> {
  const data = await request("/legislatures", z.object({ items: z.array(summarySchema) }), hourly);
  return data.items.map(mapSummary);
}

/** One legislature; null when there is none with that id. */
export async function getLegislature(id: string): Promise<Legislature | null> {
  try {
    return mapLegislature(await request(`/legislatures/${encodeURIComponent(id)}`, detailSchema, hourly));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Ids as the Parliament writes them: "Constituinte", then Roman numerals. */
export const isLegislatureId = (value: string) => value === "Constituinte" || /^[IVXL]{1,6}$/.test(value);

export const legislaturePath = (id: string) => `/legislaturas/${encodeURIComponent(id)}`;

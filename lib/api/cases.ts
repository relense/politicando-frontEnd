import { z } from "zod";
import { cached, hourly, request, searchOf } from "./client";
import { safeHttpUrl } from "./mappers";

/**
 * The curated corruption record and officeholders' declared interests, written by our editors with sources.
 * The wording on every page that shows them follows the backend's rules (docs/cases-api.md).
 */

export type Term = { key: string; label: string; plain: string | null };

export type Glossary = { crimes: Term[]; caseStatuses: Term[]; personStatuses: Term[]; interestKinds: Term[] };

export type CasePerson = {
  name: string;
  roleAtTime: string | null;
  /** The party at the time, which may differ from today's. */
  party: { slug: string; acronym: string } | null;
  deputyId: number | null;
  governmentMemberId: string | null;
  status: Term;
  final: boolean;
  outcome: string | null;
};

export type CaseSummary = {
  id: number;
  title: string;
  crimes: Term[];
  status: Term;
  statusDate: string | null;
  startedAt: string | null;
  reviewedAt: string | null;
  people: CasePerson[];
};

export type SourceKind = "court" | "official" | "news";

export type CaseSource = {
  position: number;
  url: string | null;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  kind: SourceKind;
};

export type CaseDetail = CaseSummary & {
  summary: string | null;
  events: { date: string | null; description: string; sources: number[] }[];
  sources: CaseSource[];
};

export type CasePage = { items: CaseSummary[]; total: number };

export type Interest = {
  id: number;
  personName: string;
  deputyId: number | null;
  governmentMemberId: string | null;
  kind: Term;
  entityName: string;
  nif: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  declaredAt: string | null;
  source: { url: string | null; title: string | null };
  contracts: { won: { count: number; total: number }; duringInterest: { count: number; total: number } | null } | null;
};

const termSchema = z.object({ key: z.string(), label: z.string(), plain: z.string().nullish() });
const partySchema = z.object({ slug: z.string(), acronym: z.string() }).nullish();

const personSchema = z.object({
  name: z.string(),
  roleAtTime: z.string().nullish(),
  party: partySchema,
  deputyId: z.number().nullish(),
  governmentMemberId: z.string().nullish(),
  status: termSchema,
  final: z.boolean().nullish(),
  outcome: z.string().nullish(),
});

const caseSchema = z.object({
  id: z.number(),
  title: z.string(),
  crimes: z.array(termSchema).default([]),
  status: termSchema,
  statusDate: z.string().nullish(),
  startedAt: z.string().nullish(),
  reviewedAt: z.string().nullish(),
  people: z.array(personSchema).default([]),
});

export const casePageSchema = z.object({ items: z.array(caseSchema), total: z.number().default(0) });

export const caseDetailSchema = caseSchema.extend({
  summary: z.string().nullish(),
  events: z.array(z.object({ date: z.string().nullish(), description: z.string(), sources: z.array(z.number()).default([]) })).default([]),
  sources: z
    .array(
      z.object({
        position: z.number(),
        url: z.string().nullish(),
        title: z.string(),
        publisher: z.string().nullish(),
        publishedAt: z.string().nullish(),
        kind: z.string().nullish(),
      }),
    )
    .default([]),
});

export const glossarySchema = z.object({
  crimes: z.array(termSchema).default([]),
  caseStatuses: z.array(termSchema).default([]),
  personStatuses: z.array(termSchema).default([]),
  interestKinds: z.array(termSchema).default([]),
});

const totalsSchema = z.object({ count: z.number(), total: z.number() });

export const interestsSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      personName: z.string(),
      deputyId: z.number().nullish(),
      governmentMemberId: z.string().nullish(),
      kind: termSchema,
      entityName: z.string(),
      nif: z.string().nullish(),
      description: z.string().nullish(),
      startDate: z.string().nullish(),
      endDate: z.string().nullish(),
      declaredAt: z.string().nullish(),
      source: z.object({ url: z.string().nullish(), title: z.string().nullish() }).nullish(),
      contracts: z.object({ won: totalsSchema, duringInterest: totalsSchema.nullish() }).nullish(),
    }),
  ),
});

export type ApiCasePage = z.input<typeof casePageSchema>;
export type ApiCaseDetail = z.input<typeof caseDetailSchema>;
export type ApiGlossary = z.input<typeof glossarySchema>;
export type ApiInterests = z.input<typeof interestsSchema>;

const mapTerm = (term: z.infer<typeof termSchema>): Term => ({ key: term.key, label: term.label, plain: term.plain ?? null });

function mapCase(raw: z.infer<typeof caseSchema>): CaseSummary {
  return {
    id: raw.id,
    title: raw.title,
    crimes: raw.crimes.map(mapTerm),
    status: mapTerm(raw.status),
    statusDate: raw.statusDate ?? null,
    startedAt: raw.startedAt ?? null,
    reviewedAt: raw.reviewedAt ?? null,
    people: raw.people.map((person) => ({
      name: person.name,
      roleAtTime: person.roleAtTime ?? null,
      party: person.party ?? null,
      deputyId: person.deputyId ?? null,
      governmentMemberId: person.governmentMemberId ?? null,
      status: mapTerm(person.status),
      final: person.final ?? false,
      outcome: person.outcome ?? null,
    })),
  };
}

const SOURCE_ORDER: Record<SourceKind, number> = { court: 0, official: 1, news: 2 };

export function mapCaseDetail(raw: z.infer<typeof caseDetailSchema>): CaseDetail {
  const sources = raw.sources.map((source) => ({
    position: source.position,
    url: safeHttpUrl(source.url),
    title: source.title,
    publisher: source.publisher ?? null,
    publishedAt: source.publishedAt ?? null,
    kind: (source.kind === "court" || source.kind === "official" ? source.kind : "news") as SourceKind,
  }));
  return {
    ...mapCase(raw),
    summary: raw.summary ?? null,
    events: raw.events.map((event) => ({ date: event.date ?? null, description: event.description, sources: event.sources })),
    // Court and official sources first; the numbers stay as the editors gave them, so "[2]" still points right.
    sources: sources.sort((a, b) => SOURCE_ORDER[a.kind] - SOURCE_ORDER[b.kind] || a.position - b.position),
  };
}

export const mapCasePage = (raw: z.infer<typeof casePageSchema>): CasePage => ({ items: raw.items.map(mapCase), total: raw.total });

export function mapGlossary(raw: z.infer<typeof glossarySchema>): Glossary {
  return {
    crimes: raw.crimes.map(mapTerm),
    caseStatuses: raw.caseStatuses.map(mapTerm),
    personStatuses: raw.personStatuses.map(mapTerm),
    interestKinds: raw.interestKinds.map(mapTerm),
  };
}

export function mapInterests(raw: z.infer<typeof interestsSchema>): Interest[] {
  return raw.items.map((item) => ({
    id: item.id,
    personName: item.personName,
    deputyId: item.deputyId ?? null,
    governmentMemberId: item.governmentMemberId ?? null,
    kind: mapTerm(item.kind),
    entityName: item.entityName,
    nif: item.nif && /^\d{9}$/.test(item.nif) ? item.nif : null,
    description: item.description ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    declaredAt: item.declaredAt ?? null,
    source: { url: safeHttpUrl(item.source?.url), title: item.source?.title ?? null },
    contracts: item.contracts ? { won: item.contracts.won, duringInterest: item.contracts.duringInterest ?? null } : null,
  }));
}

export type CaseQuery = { party?: string; status?: string; crime?: string; page?: number; limit?: number };

export async function getCases({ party, status, crime, page, limit }: CaseQuery = {}): Promise<CasePage> {
  return mapCasePage(await request(`/cases${searchOf({ party, status, crime, page, limit })}`, casePageSchema, cached));
}

export async function getCase(id: number): Promise<CaseDetail> {
  return mapCaseDetail(await request(`/cases/${id}`, caseDetailSchema, cached));
}

export async function getCaseGlossary(): Promise<Glossary> {
  return mapGlossary(await request("/cases/glossary", glossarySchema, hourly));
}

export type InterestQuery = { deputy?: number; member?: string; nif?: string };

/** One person's (or one company's) declared interests; with no filter, those whose entities won public contracts. */
export async function getInterests({ deputy, member, nif }: InterestQuery = {}): Promise<Interest[]> {
  const path = deputy === undefined && member === undefined && nif === undefined ? "/interests/contracts" : "/interests";
  return mapInterests(await request(`${path}${searchOf({ deputy, member, nif })}`, interestsSchema, cached));
}

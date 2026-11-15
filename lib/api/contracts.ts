import { z } from "zod";
import { cached, hourly, request, searchOf } from "./client";
import { safeHttpUrl } from "./mappers";

/*
 * Public contracts from Portal BASE (IMPIC's open data). Amounts are euros without VAT, as BASE publishes them, and
 * texts are shown exactly as published. See docs/contracts-api.md in the backend.
 */

export const PROCEDURE_KINDS = [
  "direct_award",
  "direct_award_simplified",
  "prior_consultation",
  "public_tender",
  "limited_tender",
  "framework_agreement",
  "excluded",
  "special_sectors",
  "negotiation",
  "other",
] as const;
export type ProcedureKind = (typeof PROCEDURE_KINDS)[number];

/** Ajustes diretos, the simplified ones included. */
export const DIRECT_AWARDS: readonly ProcedureKind[] = ["direct_award", "direct_award_simplified"];

/** How open a procedure is to competition: anyone can bid, only invited companies, or neither applies. */
export type Competition = "open" | "limited" | "other";

export function competitionOf(kind: string): Competition {
  if (kind === "public_tender" || kind === "limited_tender") return "open";
  if (kind === "direct_award" || kind === "direct_award_simplified" || kind === "prior_consultation") return "limited";
  return "other";
}

// ---- Schemas -------------------------------------------------------------------------------------------------

const partySchema = z.object({ nif: z.string(), name: z.string() });

const summarySchema = z.object({
  id: z.string(),
  object: z.string(),
  procedure: z.object({ kind: z.string(), label: z.string(), published: z.string().nullish() }),
  contractTypes: z.array(z.string()).default([]),
  price: z.number().nullish(),
  publishedAt: z.string().nullish(),
  signedAt: z.string().nullish(),
  entities: z.array(partySchema).default([]),
  suppliers: z.array(partySchema).default([]),
  places: z.array(z.string()).default([]),
  baseUrl: z.string().nullish(),
});

const detailSchema = summarySchema.extend({
  description: z.string().nullish(),
  procedureExplained: z.string().nullish(),
  basePrice: z.number().nullish(),
  effectivePrice: z.number().nullish(),
  cpv: z.object({ code: z.string(), description: z.string().nullish() }).nullish(),
  deadlineDays: z.number().nullish(),
  municipalities: z.array(z.object({ key: z.string(), name: z.string() })).default([]),
  legalBasis: z.string().nullish(),
  directAwardReason: z.string().nullish(),
  frameworkAgreement: z.string().nullish(),
  centralized: z.boolean().nullish(),
  invited: z.number().nullish(),
  documentsUrl: z.string().nullish(),
  status: z.string().nullish(),
});

const pageSchema = z.object({ items: z.array(summarySchema), nextCursor: z.string().nullish() });

const proceduresSchema = z.object({
  items: z.array(z.object({ kind: z.string(), label: z.string(), plain: z.string().nullish(), count: z.number(), total: z.number() })),
});

const groupSchema = z.object({ key: z.string(), label: z.string(), count: z.number(), total: z.number() });

const statsSchema = z.object({
  by: z.string(),
  items: z.array(groupSchema),
  totals: z.object({ count: z.number(), total: z.number() }),
  updatedAt: z.string().nullish(),
  source: z.string().nullish(),
});

const sideSchema = z.object({
  count: z.number(),
  total: z.number(),
  directAwards: z.number(),
  counterparts: z.array(groupSchema).default([]),
});

const contractPartySchema = z.object({
  nif: z.string(),
  name: z.string(),
  asEntity: sideSchema,
  asSupplier: sideSchema,
  latest: z.array(summarySchema).default([]),
});

const placeSchema = z.object({ key: z.string(), name: z.string(), level: z.string().nullish() });

// ---- Types ---------------------------------------------------------------------------------------------------

/** A public body or a company. `nif` is null when BASE publishes none, common for private individuals. */
export type ContractParty = { nif: string | null; name: string };

export type ContractSummary = {
  id: string;
  object: string;
  procedure: { kind: string; label: string; published: string | null };
  contractTypes: string[];
  price: number | null;
  publishedAt: string | null;
  signedAt: string | null;
  entities: ContractParty[];
  suppliers: ContractParty[];
  places: string[];
  baseUrl: string | null;
};

export type ContractDetail = ContractSummary & {
  description: string | null;
  procedureExplained: string | null;
  basePrice: number | null;
  effectivePrice: number | null;
  cpv: { code: string; description: string | null } | null;
  deadlineDays: number | null;
  municipalities: { key: string; name: string }[];
  legalBasis: string | null;
  directAwardReason: string | null;
  frameworkAgreement: string | null;
  centralized: boolean;
  invited: number | null;
  documentsUrl: string | null;
  status: string | null;
};

export type ContractPage = { items: ContractSummary[]; nextCursor: string | null };
export type ProcedureTotal = { kind: string; label: string; plain: string | null; count: number; total: number };
export type ContractGroup = z.infer<typeof groupSchema>;
export type ContractStats = {
  by: string;
  items: ContractGroup[];
  totals: { count: number; total: number };
  updatedAt: string | null;
  source: string | null;
};
export type ContractSide = { count: number; total: number; directAwards: number; counterparts: ContractGroup[] };
export type ContractPartyDetail = {
  nif: string;
  name: string;
  asEntity: ContractSide;
  asSupplier: ContractSide;
  latest: ContractSummary[];
};

// ---- Mappers -------------------------------------------------------------------------------------------------

const mapParty = (party: z.infer<typeof partySchema>): ContractParty => ({
  nif: /^\d{9}$/.test(party.nif) ? party.nif : null,
  name: party.name,
});

export function mapContractSummary(item: z.infer<typeof summarySchema>): ContractSummary {
  return {
    id: item.id,
    object: item.object,
    procedure: { kind: item.procedure.kind, label: item.procedure.label, published: item.procedure.published ?? null },
    contractTypes: item.contractTypes,
    price: item.price ?? null,
    publishedAt: item.publishedAt ?? null,
    signedAt: item.signedAt ?? null,
    entities: item.entities.map(mapParty),
    suppliers: item.suppliers.map(mapParty),
    places: item.places,
    baseUrl: safeHttpUrl(item.baseUrl),
  };
}

export function mapContractDetail(item: z.infer<typeof detailSchema>): ContractDetail {
  return {
    ...mapContractSummary(item),
    // Often just the object again; kept only when it says something more.
    description: item.description && item.description.trim() !== item.object.trim() ? item.description : null,
    procedureExplained: item.procedureExplained ?? null,
    basePrice: item.basePrice ?? null,
    effectivePrice: item.effectivePrice ?? null,
    cpv: item.cpv ? { code: item.cpv.code, description: item.cpv.description ?? null } : null,
    deadlineDays: item.deadlineDays ?? null,
    municipalities: item.municipalities.filter((place) => /^LOCAL-\d{6}$/.test(place.key)),
    legalBasis: item.legalBasis ?? null,
    directAwardReason: item.directAwardReason ?? null,
    frameworkAgreement: item.frameworkAgreement ?? null,
    centralized: item.centralized ?? false,
    invited: item.invited ?? null,
    documentsUrl: safeHttpUrl(item.documentsUrl),
    status: item.status?.trim() || null,
  };
}

// ---- Client --------------------------------------------------------------------------------------------------

export type ContractFilters = {
  procedure?: string;
  entity?: string;
  supplier?: string;
  place?: string;
  q?: string;
  from?: string;
  to?: string;
};

export type ContractQuery = ContractFilters & { sort?: "date" | "price"; limit?: number; cursor?: string };

export async function getContracts(query: ContractQuery = {}): Promise<ContractPage> {
  const result = await request(`/contracts${searchOf(query)}`, pageSchema, cached);
  return { items: result.items.map(mapContractSummary), nextCursor: result.nextCursor ?? null };
}

export async function getContract(id: string): Promise<ContractDetail> {
  return mapContractDetail(await request(`/contracts/${encodeURIComponent(id)}`, detailSchema, cached));
}

export async function getProcedureTotals(filters: ContractFilters = {}): Promise<ProcedureTotal[]> {
  const result = await request(`/contracts/procedures${searchOf(filters)}`, proceduresSchema, hourly);
  return result.items.map((item) => ({ ...item, plain: item.plain ?? null }));
}

export type StatsBy = "year" | "month" | "procedure" | "entity" | "supplier" | "municipality" | "district";

export async function getContractStats(
  by: StatsBy,
  { order, limit, ...filters }: ContractFilters & { order?: "total" | "count"; limit?: number } = {},
): Promise<ContractStats> {
  const result = await request(`/contracts/stats${searchOf({ by, order, limit, ...filters })}`, statsSchema, hourly);
  return { ...result, updatedAt: result.updatedAt ?? null, source: safeHttpUrl(result.source) };
}

export async function getContractParty(nif: string): Promise<ContractPartyDetail> {
  const result = await request(`/contracts/parties/${encodeURIComponent(nif)}`, contractPartySchema, cached);
  return { ...result, latest: result.latest.map(mapContractSummary) };
}

/** The name of a place, for "Contratos em Coimbra". */
export async function getPlaceName(key: string): Promise<string> {
  return (await request(`/places/${encodeURIComponent(key)}`, placeSchema, hourly)).name;
}

// ---- Helpers -------------------------------------------------------------------------------------------------

const exactEuros = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const wholeEuros = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });

/** "906 352,76 €". */
export const formatEuros = (value: number) => exactEuros.format(value);

/** "8,7 mil milhões €", "12,3 milhões €", "230 349 €": short enough for a headline or a ranking. */
export function formatEurosShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${oneDecimal.format(value / 1e9)} mil milhões €`;
  if (abs >= 1e6) return `${oneDecimal.format(value / 1e6)} milhões €`;
  return wholeEuros.format(value);
}

/** The unit to show a big amount in, so a headline number and its unit can be set apart. */
export function eurosScale(value: number): { divisor: number; unit: string } {
  const abs = Math.abs(value);
  if (abs >= 1e9) return { divisor: 1e9, unit: "mil milhões de euros" };
  if (abs >= 1e6) return { divisor: 1e6, unit: "milhões de euros" };
  return { divisor: 1, unit: "euros" };
}

/** "1 contrato", "2 093 contratos". */
export const contractsLabel = (count: number) =>
  `${new Intl.NumberFormat("pt-PT").format(count)} ${count === 1 ? "contrato" : "contratos"}`;

/** A part of a whole as a percentage, 0 when the whole is empty. */
export const share = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** The ajustes diretos in a list of procedure totals, and their share of all contracts and of all money. */
export function directAwardTotals(procedures: readonly ProcedureTotal[]) {
  const direct = procedures.filter((item) => DIRECT_AWARDS.includes(item.kind as ProcedureKind));
  const count = direct.reduce((sum, item) => sum + item.count, 0);
  const total = direct.reduce((sum, item) => sum + item.total, 0);
  const allCount = procedures.reduce((sum, item) => sum + item.count, 0);
  const allTotal = procedures.reduce((sum, item) => sum + item.total, 0);
  return { count, total, allCount, allTotal, countShare: share(count, allCount), totalShare: share(total, allTotal) };
}

/** Money and contracts by how open the procedure was to competition. */
export function byCompetition(procedures: readonly ProcedureTotal[]): Record<Competition, { count: number; total: number }> {
  const out: Record<Competition, { count: number; total: number }> = {
    open: { count: 0, total: 0 },
    limited: { count: 0, total: 0 },
    other: { count: 0, total: 0 },
  };
  for (const item of procedures) {
    const group = out[competitionOf(item.kind)];
    group.count += item.count;
    group.total += item.total;
  }
  return out;
}

/** The procedure filter in the address: ajustes diretos by default, "todos" for every procedure. */
export function procedureFilter(value: string | undefined): { value: string; procedure: string | undefined } {
  if (value === "todos") return { value, procedure: undefined };
  if (value && (PROCEDURE_KINDS as readonly string[]).includes(value)) return { value, procedure: value };
  return { value: "direct_award", procedure: "direct_award" };
}

export const isNif = (value: string) => /^\d{9}$/.test(value);
export const isPlaceKey = (value: string) => /^LOCAL-\d{6}$/.test(value);
export const isContractId = (value: string) => /^\d{1,12}$/.test(value);

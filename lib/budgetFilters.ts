import type { BudgetQuery, BudgetResult } from "@/lib/api/budget";

/**
 * The State Budget list's filters in the address:
 * ?partido=ps&resultado=por-votar&tema=IRS&q=…&dia=2026-11-19&ordem=numero&previsto=2026-11-23&aplicacao=nao-aplicadas.
 */

export const RESULT_TABS = [
  { key: null, label: "Todas" },
  { key: "por-votar", label: "Por votar" },
  { key: "aprovadas", label: "Aprovadas" },
  { key: "rejeitadas", label: "Rejeitadas" },
] as const;
export type ResultTab = Exclude<(typeof RESULT_TABS)[number]["key"], null>;
export const TAB_RESULTS: Record<ResultTab, BudgetResult[]> = {
  "por-votar": ["pending", "sent_to_plenary"],
  aprovadas: ["approved", "partially_approved"],
  rejeitadas: ["rejected"],
};

/** The list's order: the latest vote first (no `ordem`), or the parliament's numbering, 1C, 2C… across every day. */
export type BudgetOrder = "numero";
export const ORDERS: { key: BudgetOrder | null; label: string }[] = [
  { key: null, label: "Última votação" },
  { key: "numero", label: "Número" },
];
export type BudgetFilters = {
  party: string | null;
  result: ResultTab | null;
  topic: string | null;
  q: string | null;
  day: string | null;
  order: BudgetOrder | null;
  /** A day the voting scripts plan: its proposals, in voting order (committee, then plenary) unless ordered by number. */
  planned: string | null;
  /** «As N propostas que o Governo diz que não vai aplicar»: approved proposals announced as not applied. */
  applied: "nao-aplicadas" | null;
};
export type BudgetSearch = Record<string, string | string[] | undefined>;

export function budgetFilters(search: BudgetSearch, known: { parties: readonly string[]; topics: readonly string[] }): BudgetFilters {
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);
  const party = one(search.partido);
  const result = one(search.resultado);
  const topic = one(search.tema);
  const q = one(search.q)?.trim().slice(0, 100) || null;
  const day = one(search.dia);
  const order = one(search.ordem);
  const planned = one(search.previsto);
  const applied = one(search.aplicacao);
  const isDay = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return {
    party: party && known.parties.includes(party) ? party : null,
    result: result && result in TAB_RESULTS ? (result as ResultTab) : null,
    topic: topic && known.topics.includes(topic) ? topic : null,
    q,
    day: isDay(day) ? day : null,
    order: order === "numero" ? order : null,
    planned: isDay(planned) ? planned : null,
    applied: applied === "nao-aplicadas" ? applied : null,
  };
}

export function queryOf(filters: BudgetFilters): Omit<BudgetQuery, "cursor"> {
  return {
    party: filters.party ?? undefined,
    result: filters.result ? TAB_RESULTS[filters.result] : undefined,
    topic: filters.topic ?? undefined,
    q: filters.q ?? undefined,
    votedFrom: filters.day ?? undefined,
    votedTo: filters.day ?? undefined,
    scheduledOn: filters.planned ?? undefined,
    implementation: filters.applied ? "not_applied" : undefined,
    sort: filters.order === "numero" ? "number" : filters.planned ? "scheduled" : undefined,
    limit: 20,
  };
}

export function budgetPath(year: number, current: boolean, filters: BudgetFilters, hash = ""): string {
  const query = new URLSearchParams();
  if (filters.party) query.set("partido", filters.party);
  if (filters.result) query.set("resultado", filters.result);
  if (filters.topic) query.set("tema", filters.topic);
  if (filters.q) query.set("q", filters.q);
  if (filters.day) query.set("dia", filters.day);
  if (filters.order) query.set("ordem", filters.order);
  if (filters.planned) query.set("previsto", filters.planned);
  if (filters.applied) query.set("aplicacao", filters.applied);
  const base = current ? "/orcamento" : `/orcamento/${year}`;
  return `${base}${query.size > 0 ? `?${query}` : ""}${hash}`;
}

import { FEATURES } from "./features";

/**
 * The news filter: any number of parties and of outlets. In the address as `?partido=ps,psd&fonte=publico.pt,expresso.pt`
 * (one value, as in older links, still works), and saved as the reader's own feed in a cookie of the same shape.
 */
export type FeedFilter = { parties: string[]; sources: string[] };
/**
 * The feed's order: newest first, or the most voted, commented or read among the news of a period
 * (`?ordem=comentadas&periodo=hoje`). Orders the API can't give yet are switched off in lib/features.ts.
 */
export type FeedSort = "recentes" | "importantes" | "noticiadas" | "emalta" | "votadas" | "polemicas" | "comentadas" | "lidas";
export type FeedPeriod = "hoje" | "ontem" | "semana" | "mes";
export type FeedOrder = { sort: FeedSort; period: FeedPeriod };
export const NEWEST: FeedOrder = { sort: "recentes", period: "semana" };

export type ApiSort = "trending" | "top" | "controversial" | "comments" | "views" | "coverage";
type SortInfo = { value: FeedSort; label: string; short: string; hint: string; api: ApiSort | null; on: boolean };
const ALL_SORTS: SortInfo[] = [
  { value: "recentes", label: "Recentes", short: "Recentes", hint: "As mais recentes primeiro", api: null, on: true },
  // With stories (FEATURES.stories): the most marked "Importa", and the ones the most outlets told.
  {
    value: "importantes",
    label: "Mais importantes",
    short: "Importantes",
    hint: "As que mais leitores dizem que importam",
    api: "top",
    on: FEATURES.stories,
  },
  {
    value: "noticiadas",
    label: "Mais noticiadas",
    short: "Noticiadas",
    hint: "As que mais jornais contaram",
    api: "coverage",
    on: FEATURES.stories,
  },
  {
    value: "emalta",
    label: "Em alta",
    short: "Em alta",
    hint: "Votos, comentários e leituras dos últimos dias",
    api: "trending",
    on: FEATURES.newsTrending && !FEATURES.stories,
  },
  {
    value: "votadas",
    label: "Mais votadas",
    short: "Votadas",
    hint: "As que os leitores mais votaram",
    api: "top",
    on: FEATURES.newsVotes && !FEATURES.stories,
  },
  {
    value: "polemicas",
    label: "Polémicas",
    short: "Polémicas",
    hint: "Muitos votos a favor e contra",
    api: "controversial",
    on: FEATURES.newsVotes && !FEATURES.stories,
  },
  // With stories, "Mais debatidas": the stories with the most comments (only ones with some).
  {
    value: "comentadas",
    label: FEATURES.stories ? "Mais debatidas" : "Mais comentadas",
    short: FEATURES.stories ? "Debatidas" : "Comentadas",
    hint: "As que geram mais conversa",
    api: "comments",
    on: true,
  },
  {
    value: "lidas",
    label: "Mais lidas",
    short: "Lidas",
    hint: "As mais abertas aqui",
    api: "views",
    on: FEATURES.newsReadsSort && !FEATURES.stories,
  },
];
export const SORTS = ALL_SORTS.filter((sort) => sort.on);

/** When the news were published, in Lisbon days, as the API counts them. */
export const PERIODS: { value: FeedPeriod; label: string; phrase: string; api: "today" | "yesterday" | "week" | "month" }[] = [
  { value: "hoje", label: "Hoje", phrase: "de hoje", api: "today" },
  { value: "ontem", label: "Ontem", phrase: "de ontem", api: "yesterday" },
  { value: "semana", label: "7 dias", phrase: "dos últimos 7 dias", api: "week" },
  { value: "mes", label: "30 dias", phrase: "dos últimos 30 dias", api: "month" },
];

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The order from the address; anything unknown or switched off is newest first, over the last week. */
export function orderOf(params: { ordem?: string | string[]; periodo?: string | string[] }): FeedOrder {
  const sort = SORTS.find((item) => item.value === one(params.ordem))?.value ?? "recentes";
  const period = PERIODS.find((item) => item.value === one(params.periodo))?.value ?? "semana";
  return { sort, period };
}

/** Whether the order is over a chosen period: not newest first, nor "Em alta" (which is always the last days). */
export const timed = (order: FeedOrder) => order.sort !== "recentes" && order.sort !== "emalta";

/** The address's part for an order: nothing for the defaults. */
export const orderQuery = (order: FeedOrder) => ({
  ordem: order.sort === "recentes" ? "" : order.sort,
  periodo: !timed(order) || order.period === "semana" ? "" : order.period,
});

/** "Mais lidas" counts the reads of these last days, matching the period the news were published in. */
const READ_DAYS = { today: 1, yesterday: 2, week: 7, month: 30 } as const;

/** What to ask the API for: nothing for newest first. */
export function apiOrder(order: FeedOrder): { sort?: ApiSort; period?: "today" | "yesterday" | "week" | "month"; days?: number } {
  const api = SORTS.find((item) => item.value === order.sort)?.api;
  if (!api) return {};
  if (api === "trending") return { sort: api };
  const period = PERIODS.find((item) => item.value === order.period)!.api;
  return { sort: api, period, ...(api === "views" ? { days: READ_DAYS[period] } : {}) };
}

/** ", as mais comentadas dos últimos 7 dias primeiro", for the line above the feed. */
export function orderPhrase(order: FeedOrder): string {
  const sort = SORTS.find((item) => item.value === order.sort);
  if (!sort?.api) return ", mais recentes primeiro";
  if (sort.value === "emalta") return ", as que estão em alta primeiro";
  const period = PERIODS.find((item) => item.value === order.period)!.phrase;
  if (sort.value === "polemicas") return `, as mais polémicas ${period} primeiro`;
  return `, as ${sort.label.toLocaleLowerCase("pt")} ${period} primeiro`;
}

export const orderKey = (order: FeedOrder) => (timed(order) ? `${order.sort}-${order.period}` : order.sort);

export const FEED_COOKIE = "feed";
/** A year; the reader can change or forget it at any time. */
export const FEED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const SLUG = /^[a-z0-9-]{1,40}$/;
const DOMAIN = /^[a-z0-9.-]{3,80}$/;
const MAX = 20;

function listOf(value: string | string[] | undefined | null, valid: RegExp): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return [
    ...new Set(
      raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => valid.test(item)),
    ),
  ].slice(0, MAX);
}

/** The filter from the address (or the cookie), keeping only well-formed values; unknown ones are dropped later. */
export function parseFilter(params: { partido?: string | string[] | null; fonte?: string | string[] | null }): FeedFilter {
  return { parties: listOf(params.partido, SLUG), sources: listOf(params.fonte, DOMAIN) };
}

export const isEmpty = (filter: FeedFilter) => filter.parties.length === 0 && filter.sources.length === 0;

export const sameFilter = (a: FeedFilter, b: FeedFilter) =>
  [...a.parties].sort().join() === [...b.parties].sort().join() && [...a.sources].sort().join() === [...b.sources].sort().join();

/** "partido=ps,psd&fonte=publico.pt", without the empty parts; commas stay readable. */
export function filterQuery(filter: FeedFilter, extra: Record<string, string> = {}): string {
  const parts = [
    filter.parties.length > 0 ? `partido=${filter.parties.map(encodeURIComponent).join(",")}` : null,
    filter.sources.length > 0 ? `fonte=${filter.sources.map(encodeURIComponent).join(",")}` : null,
    ...Object.entries(extra)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`),
  ].filter(Boolean);
  return parts.join("&");
}

/** The cookie's value: the same text as the address. */
export const serializeFilter = (filter: FeedFilter) => filterQuery(filter);

export function readSavedFilter(cookie: string | undefined): FeedFilter | null {
  if (!cookie) return null;
  const params = new URLSearchParams(cookie);
  const filter = parseFilter({ partido: params.get("partido"), fonte: params.get("fonte") });
  return isEmpty(filter) ? null : filter;
}

export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** "Porque vejo isto?": the feed isn't personalised, so the answer is the order and what the article is about. */
export function whyShown(order: FeedOrder, parties: { acronym: string }[]): string {
  const sort = SORTS.find((item) => item.value === order.sort);
  const period = PERIODS.find((item) => item.value === order.period)!.phrase;
  const place = !sort?.api
    ? "está entre as notícias mais recentes"
    : sort.value === "emalta"
      ? "está em alta: votos, comentários e leituras dos últimos dias"
      : sort.value === "polemicas"
        ? `está entre as mais polémicas ${period}`
        : `está entre as ${sort.label.toLocaleLowerCase("pt")} ${period}`;
  const names = parties.map((party) => party.acronym);
  const about =
    names.length === 0 ? "" : ` e menciona ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`}`;
  return `Aparece porque ${place}${about}. O feed é igual para toda a gente: não usamos o que lês para escolher o que vês.`;
}

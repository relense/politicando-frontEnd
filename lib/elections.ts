import { majority, partyColor, SEAT_ORDER } from "./parliament";
import type { ElectionList, ElectionType, Party, PlaceLevel } from "./types";

/** In the order the menu shows them: national elections first. */
export const ELECTION_TYPES: { type: ElectionType; label: string; about: string }[] = [
  { type: "legislativas", label: "Legislativas", about: "Elegem os 230 deputados da Assembleia da República; daí sai o Governo." },
  { type: "autarquicas", label: "Autárquicas", about: "Elegem as câmaras, as assembleias municipais e as juntas de freguesia." },
  { type: "presidenciais", label: "Presidenciais", about: "Elegem o Presidente da República, por cinco anos." },
  { type: "europeias", label: "Europeias", about: "Elegem os deputados portugueses ao Parlamento Europeu." },
];

export const typeLabel = (type: ElectionType) => ELECTION_TYPES.find((item) => item.type === type)?.label ?? type;

/** The bodies elected, by the code the results use. */
export const ORGAN_LABELS: Record<string, string> = {
  AR: "Assembleia da República",
  PE: "Parlamento Europeu",
  EUR: "Parlamento Europeu",
  PR: "Presidente da República",
  CM: "Câmara Municipal",
  AM: "Assembleia Municipal",
  AF: "Assembleia de Freguesia",
};

/** The heading over the places inside a place, by their level. */
export const CHILDREN_HEADING: Record<PlaceLevel, string> = {
  global: "Por região",
  national: "Por região",
  foreign: "Por região",
  district: "Por distrito",
  municipality: "Por concelho",
  parish: "Por freguesia",
};

/** The address of an election's results, in a place and for a body; the main body and top level stay implicit. */
export function electionPath(id: string, place?: string | null, organ?: string | null): string {
  return `/eleicoes/${id}${place ? `/${place}` : ""}${organ ? `?orgao=${organ}` : ""}`;
}

/** Whether the lists win seats here: shown as seats instead of only percentages. */
export const hasMandates = (organ: string) => ["AR", "PE", "EUR", "AM", "AF", "CM"].includes(organ);

const SMALL_WORDS = new Set(["a", "o", "e", "da", "de", "do", "das", "dos", "para", "pelo", "pela", "com", "em", "por"]);

/** "ALTERNATIVA DEMOCRÁTICA NACIONAL" → "Alternativa Democrática Nacional"; acronyms such as "AD" or "PSD/CDS" stay. */
export function tidyName(value: string): string {
  if (value !== value.toUpperCase() || !/[A-ZÀ-Ý]{4}/.test(value)) return value;
  return value
    .split(/(\s+)/)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt");
      if (SMALL_WORDS.has(lower) && index > 0) return lower;
      if (/[/.\d]/.test(word) || word.length <= 3) return word;
      return lower.charAt(0).toLocaleUpperCase("pt") + lower.slice(1);
    })
    .join("");
}

const bare = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();

/**
 * Our name for a list that is exactly one of our parties (same acronym on the ballot); the ballot's name for
 * coalitions such as CDU (PCP-PEV), even when only one of their parties is ours.
 */
export function listName(item: Pick<ElectionList, "list" | "name" | "partySlugs" | "coalition">, parties: Party[]): string {
  if (item.partySlugs.length === 1 && !item.coalition) {
    const party = parties.find((candidate) => candidate.slug === item.partySlugs[0]);
    if (party && bare(party.acronym) === bare(item.list)) return tidyName(party.name);
  }
  return tidyName(item.name);
}

/** A short label: "AD" for "AD - Coligação PSD/CDS", "CDU" for "CDU - Coligação…", our acronym for one party, else the ballot's. */
export function listLabel(item: Pick<ElectionList, "list" | "name" | "partySlugs">, parties: Party[]): string {
  const head = item.name.split(" - ")[0]!.trim();
  if (head !== item.name && head.length <= 6) return head;
  if (item.partySlugs.length === 1) {
    const party = parties.find((candidate) => candidate.slug === item.partySlugs[0]);
    if (party) return party.acronym;
  }
  return item.list;
}

export const listColor = (item: Pick<ElectionList, "partySlugs">) => (item.partySlugs[0] ? partyColor(item.partySlugs[0]) : "#8a8580");

/** Lists with seats, left to right as the chamber is usually drawn; lists we don't place go to the right end. */
export function chamberOrder<T extends Pick<ElectionList, "partySlugs" | "mandates">>(lists: readonly T[]): T[] {
  const position = (item: T) => {
    const known = item.partySlugs.map((slug) => SEAT_ORDER.indexOf(slug)).filter((index) => index >= 0);
    return known.length > 0 ? Math.min(...known) : SEAT_ORDER.length;
  };
  return lists.filter((item) => (item.mandates ?? 0) > 0).sort((a, b) => position(a) - position(b));
}

/** "77 de 230 mandatos · faltaram 39 para a maioria", or "· maioria absoluta". */
export function majorityNote(won: number, total: number, past = true): string {
  const needed = majority(total);
  if (won >= needed) return `${won} de ${total} mandatos · maioria absoluta`;
  return `${won} de ${total} mandatos · ${past ? "faltaram" : "faltam"} ${needed - won} para a maioria`;
}

/**
 * One plain sentence on who won: "AD venceu com 32,5% dos votos e 88 mandatos, sem maioria absoluta. Seguiram-se
 * Chega (60 mandatos) e Partido Socialista (58)." Without seats, by share of votes.
 */
export function resultSentence(
  lists: readonly ElectionList[],
  parties: Party[],
  total: number | null,
  percent: (value: number | null) => string | null,
): string | null {
  const ranked = total ? [...lists].sort((a, b) => (b.mandates ?? 0) - (a.mandates ?? 0) || b.votes - a.votes) : lists;
  const [first, second, third] = ranked;
  if (!first) return null;
  const name = (item: ElectionList) => listName(item, parties);
  if (total && first.mandates !== null) {
    const seats = (n: number | null) => `${n} ${n === 1 ? "mandato" : "mandatos"}`;
    const outcome = total === 1 ? "" : (first.mandates ?? 0) >= majority(total) ? ", com maioria absoluta" : ", sem maioria absoluta";
    let text = `${name(first)} venceu com ${percent(first.validPct)} dos votos e ${seats(first.mandates)}${outcome}.`;
    if (second && (second.mandates ?? 0) > 0)
      text +=
        third && (third.mandates ?? 0) > 0
          ? ` Seguiram-se ${name(second)} (${seats(second.mandates)}) e ${name(third)} (${third.mandates}).`
          : ` Seguiu-se ${name(second)} (${seats(second.mandates)}).`;
    return text;
  }
  let text = `${name(first)} foi a lista mais votada, com ${percent(first.validPct)} dos votos.`;
  if (second)
    text += third
      ? ` Seguiram-se ${name(second)} (${percent(second.validPct)}) e ${name(third)} (${percent(third.validPct)}).`
      : ` Seguiu-se ${name(second)} (${percent(second.validPct)}).`;
  return text;
}

/**
 * One entry per set of parties: AD ran as two lists in 2025 (the mainland and Madeira), which count together in
 * Parliament. Votes and seats add up; the name is the bigger list's. Lists with none of our parties stay apart.
 */
export function mergeSameParties(lists: readonly ElectionList[]): ElectionList[] {
  const merged = new Map<string, ElectionList>();
  for (const item of lists) {
    const key = item.partySlugs.length > 0 ? [...item.partySlugs].sort().join("+") : `lista:${item.list}:${item.name}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...item });
      continue;
    }
    const bigger = item.votes > current.votes ? item : current;
    merged.set(key, {
      ...bigger,
      votes: current.votes + item.votes,
      validPct: current.validPct === null && item.validPct === null ? null : (current.validPct ?? 0) + (item.validPct ?? 0),
      pct: current.pct === null && item.pct === null ? null : (current.pct ?? 0) + (item.pct ?? 0),
      mandates: current.mandates === null && item.mandates === null ? null : (current.mandates ?? 0) + (item.mandates ?? 0),
    });
  }
  return [...merged.values()].sort((a, b) => b.votes - a.votes);
}

/** The change from the previous election of the same type, for one list. */
export type ListChange = { previousPct: number | null; change: number | null };

type Comparable = Pick<ElectionList, "list" | "partySlugs" | "validPct">;

/**
 * Small partners that come and go from a coalition without changing what it is: AD was PSD, CDS-PP and PPM in 2024
 * and PSD and CDS-PP in 2025. Left out when deciding whether two lists are the same.
 */
const MINOR_PARTNERS = new Set(["ppm", "pev", "mpt"]);

const slugSet = (item: Pick<ElectionList, "partySlugs">) => {
  const core = item.partySlugs.filter((slug) => !MINOR_PARTNERS.has(slug));
  return [...(core.length > 0 ? core : item.partySlugs)].sort().join("+");
};

/**
 * The same parties running as more than one list (AD on the mainland, and PSD with CDS-PP in Madeira) count as one,
 * with their shares added, so a small regional list is never taken for the national one.
 */
function mergeForComparison(lists: readonly Comparable[]): Comparable[] {
  const merged = new Map<string, Comparable & { biggest: number }>();
  for (const item of lists) {
    const key = item.partySlugs.length > 0 ? slugSet(item) : `lista:${bare(item.list)}`;
    const current = merged.get(key);
    const share = item.validPct ?? 0;
    if (!current) {
      merged.set(key, { ...item, biggest: share });
      continue;
    }
    merged.set(key, {
      ...(share > current.biggest ? item : current),
      biggest: Math.max(share, current.biggest),
      validPct: current.validPct === null && item.validPct === null ? null : (current.validPct ?? 0) + share,
    });
  }
  return [...merged.values()];
}

/**
 * Matches each list with the same list in the previous election, one to one: first the same ballot name and the same
 * parties, then the same parties (AD under a new name, or without a small partner), then the same ballot name for
 * lists none of ours is in (citizens' groups, and candidates in presidenciais). A coalition is never matched with its
 * parties running alone, nor the other way round: those numbers are not comparable, so such lists have no change.
 */
export function compareLists<T extends Comparable>(current: readonly T[], previousLists: readonly Comparable[]): Map<T, ListChange> {
  const previous = mergeForComparison(previousLists);
  const used = new Set<number>();
  const matched = new Map<T, number>();
  const passes: ((a: T, b: Comparable) => boolean)[] = [
    (a, b) => bare(a.list) === bare(b.list) && slugSet(a) === slugSet(b),
    (a, b) => a.partySlugs.length > 0 && slugSet(a) === slugSet(b),
    (a, b) => a.partySlugs.length === 0 && b.partySlugs.length === 0 && bare(a.list) === bare(b.list),
  ];
  for (const pass of passes) {
    for (const item of current) {
      if (matched.has(item)) continue;
      const index = previous.findIndex((candidate, at) => !used.has(at) && pass(item, candidate));
      if (index >= 0) {
        used.add(index);
        matched.set(item, index);
      }
    }
  }
  return new Map(
    current.map((item) => {
      const index = matched.get(item);
      const before = index === undefined ? null : (previous[index]!.validPct ?? null);
      const change = before !== null && item.validPct !== null ? Math.round((item.validPct - before) * 10) / 10 : null;
      return [item, { previousPct: before, change }];
    }),
  );
}

const pointsFormatter = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** "+2,3 pp", "−0,4 pp", "0,0 pp": a change in percentage points. */
export function formatPoints(change: number): string {
  return `${pointsFormatter.format(change).replace("-", "−")} pp`;
}

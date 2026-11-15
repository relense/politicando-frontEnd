import type { ElectionList, ElectionType, PartyStanding, PlaceLevel } from "./types";

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

/**
 * Each party's seats and its votes in one election. A party in several lists (AD on the mainland and in Madeira)
 * adds them up; a coalition's votes count for each partner, marked with the name of its biggest coalition. Parties
 * with seats but no list of their own still count.
 */
export function partyStandings(seats: ReadonlyMap<string, number>, lists: readonly ElectionList[]): Record<string, PartyStanding> {
  const standings: Record<string, PartyStanding> = {};
  const biggestCoalition = new Map<string, number>();
  for (const item of lists) {
    for (const slug of item.partySlugs) {
      const current = standings[slug] ?? { seats: seats.get(slug) ?? 0, votes: 0, validPct: 0, coalition: null };
      const takesName = item.coalition && item.votes > (biggestCoalition.get(slug) ?? -1);
      if (takesName) biggestCoalition.set(slug, item.votes);
      standings[slug] = {
        ...current,
        votes: current.votes + item.votes,
        validPct: Math.round((current.validPct + (item.validPct ?? 0)) * 100) / 100,
        coalition: takesName ? item.name : current.coalition,
      };
    }
  }
  for (const [slug, count] of seats) standings[slug] ??= { seats: count, votes: 0, validPct: 0, coalition: null };
  return standings;
}

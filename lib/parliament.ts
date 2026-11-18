import type { InitiativeStatus } from "./types";

/** Seat colours. Each seat's party is also named on hover, in the card and in the list, so colour is never the only cue. */
export const PARTY_COLORS: Record<string, string> = {
  pcp: "#c8102e",
  be: "#8b1e3f",
  livre: "#2e9e5b",
  pan: "#0f8b8d",
  ps: "#e4508f",
  jpp: "#7a9a01",
  psd: "#f28c28",
  "cds-pp": "#1c75bc",
  il: "#22b5e5",
  chega: "#2b2f8f",
};
const FALLBACK_COLOR = "#8a8580";

/**
 * Left to right as seen from the Mesa, as the chamber is usually read. In the official plan the smallest groups
 * sit inside larger benches, which would scatter them into single dots in the drawing.
 */
export const SEAT_ORDER = ["pcp", "be", "livre", "pan", "ps", "jpp", "psd", "cds-pp", "il", "chega"];

export const partyColor = (slug: string) => PARTY_COLORS[slug] ?? FALLBACK_COLOR;

export const STATUS_LABELS: Record<InitiativeStatus, string> = {
  approved: "Aprovada",
  in_progress: "Em discussão",
  rejected: "Rejeitada",
  withdrawn: "Retirada",
};

/** Seats needed for an absolute majority. */
export const majority = (seats: number) => Math.floor(seats / 2) + 1;

/**
 * Electoral coalitions whose parties sit as separate parliamentary groups. Shown together in the legend,
 * while seats and votes stay per party, as the Parliament records them.
 */
export const COALITIONS = [{ acronym: "AD", name: "Aliança Democrática", parties: ["psd", "cds-pp"] }];

/** Whole years between a "1978-11-11" birth date and `now`. */
export function ageOn(birthDate: string | null, now: Date): number | null {
  const match = birthDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const hadBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}

const LEADER = /^(Presidente|Secretári[oa]-Geral|Porta-voz|Coordenador[a]?)\b(?!.*(Assembleia|Comiss|Grupo))/;
/** "Presidente do CDS-PP", "Secretário-Geral do PS": a post leading a party, not a committee or the chamber. */
export const isPartyLeaderPost = (post: string) => LEADER.test(post);

/**
 * The party's leader and its leader in Parliament, when they sit as deputies. No open data says who leads each party,
 * so this reads the posts in their Parliament records ("Presidente do CHEGA", "Líder do grupo parlamentar").
 */
export function partyLeaders<T extends { partySlug: string | null; positions: string[] }>(deputies: readonly T[], slug: string) {
  const own = deputies.filter((deputy) => deputy.partySlug === slug);
  const leader = own.find((deputy) => deputy.positions.some((position) => LEADER.test(position))) ?? null;
  const benchLeader = own.find((deputy) => deputy.positions.some((position) => /^Líder do grupo parlamentar/i.test(position))) ?? null;
  return {
    leader: leader ? { deputy: leader, title: leader.positions.find((position) => LEADER.test(position))! } : null,
    benchLeader,
  };
}

import type { Mayor, PlaceSummary } from "./api/places";
import { tidyName } from "./elections";
import { partyColor } from "./parliament";
import type { Party } from "./types";

/** Our page for a place: `/sitios/LOCAL-060300`. */
export const placePath = (key: string) => `/sitios/${key}`;

/** Keys with a place page: the districts, municipalities and parishes of Portugal. */
export const PLACE_KEY = /^LOCAL-\d{6}$/;

/** Citizens' groups have no party: one neutral colour for all of them, unlike any party's. */
export const INDEPENDENT_COLOR = "#b3a58c";
export const INDEPENDENT_LABEL = "Independentes";

/** The colour of a place on the map: the main party of the mayor's list, or the independents' colour. */
export const mayorColor = (mayor: Pick<Mayor, "parties"> | null): string | null =>
  mayor ? (mayor.parties[0] ? partyColor(mayor.parties[0]) : INDEPENDENT_COLOR) : null;

/** "PS", "PSD", or the slug in capitals for parties we don't list; null for citizens' groups. */
export function mainParty(mayor: Pick<Mayor, "parties"> | null, parties: readonly Party[]): string | null {
  const slug = mayor?.parties[0];
  if (!slug) return null;
  return parties.find((party) => party.slug === slug)?.acronym ?? slug.toUpperCase();
}

/** "PS/L/PAN" from our acronyms, or the ballot's list name for citizens' groups ("Avançar Coimbra"). */
export function mayorListLabel(mayor: Mayor, parties: readonly Party[]): string {
  if (mayor.parties.length === 0) return tidyName(mayor.label);
  return mayor.parties.map((slug) => parties.find((party) => party.slug === slug)?.acronym ?? slug.toUpperCase()).join("/");
}

export type LegendItem = { key: string; label: string; color: string; count: number };

/**
 * How many câmaras each party leads, by the main party of the winning list, biggest first. Citizens' groups
 * count together as "Independentes".
 */
export function mayorLegend(places: readonly Pick<PlaceSummary, "mayor">[], parties: readonly Party[]): LegendItem[] {
  const groups = new Map<string, LegendItem>();
  for (const { mayor } of places) {
    if (!mayor) continue;
    const key = mayor.parties[0] ?? "independentes";
    const current = groups.get(key) ?? {
      key,
      label: mayor.parties[0] ? mainParty(mayor, parties)! : INDEPENDENT_LABEL,
      color: mayorColor(mayor)!,
      count: 0,
    };
    groups.set(key, { ...current, count: current.count + 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt"));
}

/** Initials for a portrait without a photo: first and last name. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => part.length > 2 || /^[A-ZÀ-Ý]/.test(part))
    .filter((_, index, all) => index === 0 || index === all.length - 1)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** The year of an election from its id: "autarquicas-2025" → "Autárquicas 2025". */
export function electionName(id: string): string {
  const [type, year] = id.split("-");
  const names: Record<string, string> = {
    autarquicas: "Autárquicas",
    legislativas: "Legislativas",
    europeias: "Europeias",
    presidenciais: "Presidenciais",
  };
  return year ? `${names[type!] ?? type} ${year}` : id;
}

const euroFormatter = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });

/** "169,4 milhões de euros", "850 mil euros", "1 200 €". */
export function formatEuros(value: number): string {
  if (value >= 1e9) return `${compactFormatter.format(value / 1e9)} mil milhões de euros`;
  if (value >= 1e6) return `${compactFormatter.format(value / 1e6)} milhões de euros`;
  if (value >= 1e4) return `${compactFormatter.format(value / 1e3)} mil euros`;
  return euroFormatter.format(value);
}

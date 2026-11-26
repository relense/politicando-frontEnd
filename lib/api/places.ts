import { z } from "zod";
import type { Place, PlaceLevel } from "@/lib/types";
import { hourly, request, searchOf } from "./client";
import { safeHttpUrl } from "./mappers";

/**
 * Places and who represents them (`GET /places`, `GET /places/:key`): the presidente da câmara of each
 * municipality, the seats on its councils, the deputies of its círculo, its latest elections and public contracts.
 */

const levelSchema = z.enum(["global", "national", "foreign", "district", "municipality", "parish"]);
const text = z.string().nullish();

const mayorSchema = z.object({
  /** Their own page: /autarcas/:id (GET /local-officials/:id). */
  id: text,
  name: z.string(),
  list: z.string(),
  label: text,
  parties: z.array(z.string()).nullish(),
  election: text,
});

const placeRefSchema = z.object({ key: z.string(), name: z.string(), level: levelSchema, dicofre: text });

export const placeListSchema = z.object({
  items: z.array(placeRefSchema.extend({ parentKey: text, mayor: mayorSchema.nullish() })),
});

const seatSchema = z.object({
  list: z.string(),
  label: text,
  parties: z.array(z.string()).nullish(),
  votes: z.number().nullish(),
  validPct: z.number().nullish(),
  mandates: z.number().nullish(),
  /** Who the list elected, in list order (CNE's official map); missing until the API imports them. */
  members: z
    .array(z.object({ name: z.string(), position: z.number().nullish(), role: text, localOfficialId: text }))
    .nullish()
    .catch(null),
});

export const placeDetailSchema = placeRefSchema.extend({
  parent: placeRefSchema.nullish(),
  children: z.array(placeRefSchema).nullish(),
  mayor: mayorSchema.nullish(),
  /** A parish: the head of the most-voted list for its assembleia de freguesia. */
  juntaPresident: mayorSchema.nullish().catch(null),
  council: z
    .object({
      election: z.string(),
      organs: z.array(z.object({ organ: z.string(), totalMandates: z.number().nullish(), seats: z.array(seatSchema) })),
      /** Where the names come from; `asOf` is the official map's latest rectification. Null when no names are loaded. */
      source: z.object({ name: z.string(), url: text, asOf: text }).nullish().catch(null),
    })
    .nullish(),
  deputies: z
    .object({
      circle: z.object({ key: z.string(), name: z.string() }),
      items: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          photoUrl: text,
          party: z.object({ slug: z.string(), acronym: z.string() }).nullish(),
        }),
      ),
    })
    .nullish(),
  elections: z
    .array(
      z.object({
        election: z.string(),
        name: z.string(),
        date: z.string(),
        organ: text,
        turnoutPct: z.number().nullish(),
        winner: z.object({ list: z.string(), label: text, validPct: z.number().nullish() }).nullish(),
      }),
    )
    .nullish(),
  contracts: z
    .object({
      carriedOut: z.object({ count: z.number(), total: z.number() }).nullish(),
      council: z.object({ nif: z.string(), name: z.string(), count: z.number(), total: z.number(), directAwards: z.number() }).nullish(),
    })
    .nullish(),
});

export type ApiPlaceList = z.input<typeof placeListSchema>;
export type ApiPlaceDetail = z.input<typeof placeDetailSchema>;

export type Mayor = {
  /** Their page's id, when the API gives one. */
  id: string | null;
  name: string;
  /** The ballot's code, e.g. "PS.L.PAN". */
  list: string;
  /** The list's name on the ballot, e.g. "AVANÇAR COIMBRA". */
  label: string;
  /** Our parties in the winning list, the main one first; empty for citizens' groups. */
  parties: string[];
  election: string | null;
};

export type PlaceSummary = Place & { parentKey: string | null; mayor: Mayor | null };

export type CouncilSeats = {
  list: string;
  label: string;
  parties: string[];
  votes: number | null;
  validPct: number | null;
  mandates: number;
  /** Who it elected, in list order; null until the API sends names, [] when this list's are unknown. */
  members: CouncilMember[] | null;
};

/** Someone elected on the night (later substitutions aren't tracked anywhere public). */
export type CouncilMember = { name: string; position: number | null; president: boolean; localOfficialId: string | null };

export type CouncilOrgan = { organ: string; totalMandates: number; seats: CouncilSeats[] };

export type Council = {
  election: string;
  organs: CouncilOrgan[];
  /** `asOf`: the official map's latest rectification (ISO date), not the election day. */
  source: { name: string; url: string | null; asOf: string | null } | null;
};

export type PlaceDeputy = { id: number; name: string; photoUrl: string | null; party: { slug: string; acronym: string } | null };

export type PlaceElection = {
  election: string;
  name: string;
  date: string;
  organ: string | null;
  turnoutPct: number | null;
  winner: { list: string; label: string; validPct: number | null } | null;
};

export type PlaceDetail = Place & {
  parent: Place | null;
  children: Place[];
  mayor: Mayor | null;
  /** A parish's junta president, worked out from the results; no page of their own. */
  juntaPresident: Mayor | null;
  council: Council | null;
  deputies: { circle: { key: string; name: string }; items: PlaceDeputy[] } | null;
  elections: PlaceElection[];
  contracts: {
    carriedOut: { count: number; total: number } | null;
    council: { nif: string; name: string; count: number; total: number; directAwards: number } | null;
  };
};

const mapRef = (place: z.output<typeof placeRefSchema>): Place => ({
  key: place.key,
  name: place.name,
  level: place.level,
  dicofre: place.dicofre ?? null,
});

const mapMayor = (mayor: z.output<typeof mayorSchema> | null | undefined): Mayor | null =>
  mayor
    ? {
        id: mayor.id ?? null,
        name: mayor.name,
        list: mayor.list,
        label: mayor.label || mayor.list,
        parties: mayor.parties ?? [],
        election: mayor.election ?? null,
      }
    : null;

export function mapPlaces(input: z.output<typeof placeListSchema>): PlaceSummary[] {
  return input.items.map((item) => ({ ...mapRef(item), parentKey: item.parentKey ?? null, mayor: mapMayor(item.mayor) }));
}

export function mapPlaceDetail(input: z.output<typeof placeDetailSchema>): PlaceDetail {
  const council = input.council
    ? {
        election: input.council.election,
        organs: input.council.organs
          .map((organ) => {
            const seats = organ.seats
              .map((seat) => ({
                list: seat.list,
                label: seat.label || seat.list,
                parties: seat.parties ?? [],
                votes: seat.votes ?? null,
                validPct: seat.validPct ?? null,
                mandates: seat.mandates ?? 0,
                members: seat.members
                  ? seat.members
                      .map((member) => ({
                        name: member.name,
                        position: member.position ?? null,
                        president: member.role === "presidente",
                        localOfficialId: member.localOfficialId ?? null,
                      }))
                      .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
                  : null,
              }))
              .sort((a, b) => b.mandates - a.mandates || (b.votes ?? 0) - (a.votes ?? 0));
            const won = seats.reduce((sum, seat) => sum + seat.mandates, 0);
            return { organ: organ.organ, totalMandates: organ.totalMandates ?? won, seats };
          })
          .filter((organ) => organ.seats.length > 0),
        source: input.council.source
          ? { name: input.council.source.name, url: safeHttpUrl(input.council.source.url), asOf: input.council.source.asOf ?? null }
          : null,
      }
    : null;
  const contracts = input.contracts ?? {};
  return {
    ...mapRef(input),
    parent: input.parent ? mapRef(input.parent) : null,
    children: (input.children ?? []).map(mapRef).sort((a, b) => a.name.localeCompare(b.name, "pt")),
    mayor: mapMayor(input.mayor),
    juntaPresident: mapMayor(input.juntaPresident),
    council: council && council.organs.length > 0 ? council : null,
    deputies: input.deputies
      ? {
          circle: input.deputies.circle,
          items: input.deputies.items.map((deputy) => ({
            id: deputy.id,
            name: deputy.name,
            photoUrl: safeHttpUrl(deputy.photoUrl),
            party: deputy.party ?? null,
          })),
        }
      : null,
    elections: (input.elections ?? []).map((item) => ({
      election: item.election,
      name: item.name,
      date: item.date,
      organ: item.organ ?? null,
      turnoutPct: item.turnoutPct ?? null,
      winner: item.winner
        ? { list: item.winner.list, label: item.winner.label || item.winner.list, validPct: item.winner.validPct ?? null }
        : null,
    })),
    contracts: {
      carriedOut: contracts.carriedOut ?? null,
      council: contracts.council && contracts.council.nif ? contracts.council : null,
    },
  };
}

/** Every place of one level (municipalities by default), optionally inside another, with its mayor. */
export async function getPlaces({
  level,
  parent,
}: { level?: Exclude<PlaceLevel, "global" | "national" | "foreign">; parent?: string } = {}) {
  return mapPlaces(await request(`/places${searchOf({ level, parent })}`, placeListSchema, hourly));
}

/** One place with who represents it and what happens there. */
export async function getPlaceDetail(key: string): Promise<PlaceDetail> {
  return mapPlaceDetail(await request(`/places/${encodeURIComponent(key)}`, placeDetailSchema, hourly));
}

import { z } from "zod";
import { cached, request, searchOf } from "./client";
import { mapArticle } from "./mappers";
import { articleSchema } from "./schemas";
import type { Article } from "@/lib/types";

/**
 * Local officials with a page of their own (`GET /local-officials/:id`): for now the 308 presidentes de câmara, from
 * the 2025 autárquicas. No open source names the vereadores or the presidentes de junta.
 */

const placeSchema = z.object({ key: z.string(), name: z.string(), level: z.string() });

export const localOfficialSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullish(),
  role: z.string(),
  title: z.string(),
  place: placeSchema,
  district: placeSchema.nullish(),
  list: z.string().nullish(),
  label: z.string().nullish(),
  parties: z.array(z.string()).nullish(),
  election: z.string().nullish(),
  term: z.object({ start: z.string().nullish(), end: z.string().nullish() }).nullish(),
  current: z.boolean().nullish(),
  otherRoles: z
    .array(
      z.object({
        kind: z.string(),
        title: z.string(),
        detail: z.string().nullish(),
        date: z.string().nullish(),
        current: z.boolean().nullish(),
        elected: z.boolean().nullish(),
        link: z.string().nullish(),
      }),
    )
    .nullish(),
  articles: z.array(articleSchema).nullish(),
  updatedAt: z.string().nullish(),
});

export type LocalOfficial = {
  id: string;
  name: string;
  /** As the news writes it ("Carlos Moedas"); the full name when the API has no shorter one. */
  shortName: string;
  title: string;
  place: { key: string; name: string };
  district: { key: string; name: string } | null;
  /** The winning list's name on the ballot, and our parties in it (main first; empty for citizens' groups). */
  label: string | null;
  parties: string[];
  election: string | null;
  term: { start: string | null; end: string | null };
  current: boolean;
  otherRoles: {
    kind: string;
    title: string;
    detail: string | null;
    date: string | null;
    current: boolean;
    elected: boolean;
    href: string | null;
  }[];
  articles: Article[];
};

/** The API's links point at its own routes ("/deputies/1047", "/elections/…"); ours are in Portuguese. */
function siteHref(link: string | null | undefined): string | null {
  if (!link) return null;
  const deputy = link.match(/^\/deputies\/(\d+)$/);
  if (deputy) return `/deputados/${deputy[1]}`;
  const election = link.match(/^\/elections\/([a-z0-9-]+)/);
  if (election) return `/eleicoes/${election[1]}`;
  return null;
}

export function mapLocalOfficial(api: z.infer<typeof localOfficialSchema>): LocalOfficial {
  return {
    id: api.id,
    name: api.name,
    shortName: api.shortName || api.name,
    title: api.title,
    place: { key: api.place.key, name: api.place.name },
    district: api.district ? { key: api.district.key, name: api.district.name } : null,
    label: api.label || api.list || null,
    parties: api.parties ?? [],
    election: api.election ?? null,
    term: { start: api.term?.start ?? null, end: api.term?.end ?? null },
    current: api.current ?? true,
    otherRoles: (api.otherRoles ?? []).map((role) => ({
      kind: role.kind,
      title: role.title,
      detail: role.detail ?? null,
      date: role.date ?? null,
      current: role.current ?? false,
      elected: role.elected ?? false,
      href: siteHref(role.link),
    })),
    articles: (api.articles ?? []).map(mapArticle),
  };
}

export async function getLocalOfficial(id: string): Promise<LocalOfficial> {
  return mapLocalOfficial(await request(`/local-officials/${encodeURIComponent(id)}`, localOfficialSchema, cached));
}

/** A local official's page on this site (the backend announces the same address to IndexNow). */
export const localOfficialPath = (id: string) => `/autarcas/${encodeURIComponent(id)}`;

// ── Search by name (places-api.md "GET /local-officials/search") ───────────────────────────────────────────────────────

const ORGANS = ["CM", "AM", "AF"] as const;
const placeRef = z.object({ key: z.string(), name: z.string(), level: z.string().nullish() });
const searchItemSchema = z.object({
  name: z.string().min(1),
  organ: z.enum(ORGANS),
  role: z.string().nullish(),
  place: placeRef,
  municipality: placeRef.nullish().catch(null),
  list: z.string().nullish(),
  label: z.string().nullish(),
  parties: z.array(z.string()).nullish().catch(null),
  localOfficialId: z.string().nullish(),
});
const searchSchema = z.object({ items: z.array(z.unknown()).catch([]) });

/** Anyone elected locally (CNE's map, latest autárquicas): the body, whether they preside, the place, the list. */
export type LocalOfficialHit = {
  name: string;
  organ: (typeof ORGANS)[number];
  president: boolean;
  place: { key: string; name: string };
  municipality: { key: string; name: string } | null;
  list: string | null;
  label: string | null;
  parties: string[];
  localOfficialId: string | null;
};

/** By name, best match first; a bad item is left out. `q` needs 3+ characters (the API answers 400 otherwise). */
export async function searchLocalOfficials(q: string, limit = 10): Promise<LocalOfficialHit[]> {
  const raw = await request(`/local-officials/search${searchOf({ q, limit })}`, searchSchema, cached);
  return raw.items.flatMap((entry) => {
    const parsed = searchItemSchema.safeParse(entry);
    if (!parsed.success) return [];
    const item = parsed.data;
    return [
      {
        name: item.name,
        organ: item.organ,
        president: item.role === "presidente",
        place: { key: item.place.key, name: item.place.name },
        municipality: item.municipality ? { key: item.municipality.key, name: item.municipality.name } : null,
        list: item.list ?? null,
        label: item.label ?? null,
        parties: item.parties ?? [],
        localOfficialId: item.localOfficialId ?? null,
      },
    ];
  });
}

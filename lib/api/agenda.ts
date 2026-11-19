import { z } from "zod";
import { AGENDA_KINDS, nextEventOf, type AgendaItem, type AgendaKind } from "@/lib/agenda";
import { ApiError, cached, request, searchOf } from "./client";
import { safeHttpUrl } from "./mappers";

/** The political calendar (contract: docs/agenda-api.md in the backend repo). */

const itemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  kind: z.string(),
  title: z.string(),
  summary: z.string().nullish(),
  start: z.string(),
  end: z.string().nullish(),
  allDay: z.boolean().nullish(),
  status: z.string().nullish(),
  place: z
    .object({
      name: z.string(),
      address: z.string().nullish(),
      municipality: z.string().nullish(),
      district: z.string().nullish(),
      lat: z.number().nullish(),
      lng: z.number().nullish(),
    })
    .nullish(),
  online: z.object({ url: z.string(), label: z.string().nullish() }).nullish(),
  attend: z.object({ open: z.boolean(), how: z.string().nullish(), url: z.string().nullish() }).nullish(),
  organizer: z.string().nullish(),
  parties: z.array(z.object({ slug: z.string(), acronym: z.string() })).default([]),
  sourceUrl: z.string().nullish(),
  featured: z.boolean().nullish(),
});

const pageSchema = z.object({ items: z.array(itemSchema), nextCursor: z.string().nullish(), total: z.number().nullish() });

export function mapAgendaItem(raw: z.infer<typeof itemSchema>): AgendaItem {
  const online = raw.online ? safeHttpUrl(raw.online.url) : null;
  return {
    id: raw.id,
    kind: (AGENDA_KINDS as readonly string[]).includes(raw.kind) ? (raw.kind as AgendaKind) : "other",
    title: raw.title,
    summary: raw.summary || null,
    start: raw.start,
    end: raw.end ?? null,
    allDay: raw.allDay ?? /^\d{4}-\d{2}-\d{2}$/.test(raw.start),
    status: raw.status === "cancelled" || raw.status === "postponed" ? raw.status : "scheduled",
    place: raw.place
      ? {
          name: raw.place.name,
          address: raw.place.address ?? null,
          municipality: raw.place.municipality ?? null,
          district: raw.place.district ?? null,
          lat: raw.place.lat ?? null,
          lng: raw.place.lng ?? null,
        }
      : null,
    online: online ? { url: online, label: raw.online?.label ?? null } : null,
    attend: { open: raw.attend?.open ?? false, how: raw.attend?.how ?? null, url: safeHttpUrl(raw.attend?.url ?? null) },
    organizer: raw.organizer ?? null,
    parties: raw.parties,
    sourceUrl: safeHttpUrl(raw.sourceUrl ?? null),
    featured: raw.featured ?? false,
  };
}

export type AgendaQuery = { kinds?: AgendaKind[]; district?: string; open?: boolean; from?: string; cursor?: string; limit?: number };

export type AgendaPage = { items: AgendaItem[]; nextCursor: string | null; total: number | null };

/** What is coming, soonest first; null while the API has no calendar yet. */
export async function getAgenda({ kinds = [], district, open, from, cursor, limit = 50 }: AgendaQuery = {}): Promise<AgendaPage | null> {
  const search = searchOf({
    kind: kinds.join(",") || undefined,
    district,
    open: open ? "true" : undefined,
    from,
    cursor,
    limit,
  });
  try {
    const page = await request(`/agenda${search}`, pageSchema, cached);
    return { items: page.items.map(mapAgendaItem), nextCursor: page.nextCursor ?? null, total: page.total ?? null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** For the front page: the next featured event in the coming weeks, else simply the next one; null when there is none. */
export async function getNextEvent(): Promise<AgendaItem | null> {
  const page = await getAgenda({ limit: 20 }).catch(() => null);
  // At render time (the front page is rendered per visit): what already started without an end isn't "next".
  return nextEventOf(page?.items ?? [], Date.now());
}

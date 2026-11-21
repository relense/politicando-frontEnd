import { z } from "zod";
import { hourly, request } from "./client";

/** What the backend says belongs in the sitemap (see the backend's docs/seo.md). */
export const SITEMAP_KINDS = [
  "party",
  "deputy",
  "government-member",
  "president",
  "election",
  "place",
  "initiative",
  "editorial",
  "case",
  "local-official",
] as const;
export type SitemapKind = (typeof SITEMAP_KINDS)[number];

const indexSchema = z.object({
  pageSize: z.number(),
  kinds: z.array(z.object({ kind: z.string(), count: z.number(), pages: z.number() })),
});

const pageSchema = z.object({
  items: z.array(z.object({ id: z.union([z.string(), z.number()]), lastmod: z.string().nullish(), level: z.string().nullish() })),
});

export type SitemapItem = { id: string; lastmod: string | null; level: string | null };

/** Every page of every kind we know, as `{ kind: items }`. Kinds we don't know are skipped. */
export async function getSitemapItems(): Promise<Partial<Record<SitemapKind, SitemapItem[]>>> {
  const { kinds } = await request("/sitemap", indexSchema, hourly);
  const known = kinds.filter((entry): entry is typeof entry & { kind: SitemapKind } =>
    (SITEMAP_KINDS as readonly string[]).includes(entry.kind),
  );
  const lists = await Promise.all(
    known.map(async ({ kind, pages }) => {
      const results = await Promise.all(
        // One page failing loses only that page, not every other kind's.
        Array.from({ length: pages }, (_, index) =>
          request(`/sitemap/${kind}?page=${index + 1}`, pageSchema, hourly).catch(() => ({ items: [] })),
        ),
      );
      const items = results.flatMap((result) =>
        result.items.map((item) => ({ id: String(item.id), lastmod: item.lastmod ?? null, level: item.level ?? null })),
      );
      return [kind, items] as const;
    }),
  );
  return Object.fromEntries(lists);
}

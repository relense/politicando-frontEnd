import { z } from "zod";
import { request } from "./client";

/**
 * Today's news counts (docs/api-handoff.md, "News counts per outlet and per party"): `GET /articles/sources?since=` and
 * `GET /articles/parties?since=`. An older API ignores `since` and answers all-time counts without `total`: those are
 * left out, never shown as today's. Each list that fails is empty; the box hides when there's nothing.
 */

export type TodayCounts = {
  total: number;
  sources: { name: string; count: number }[];
  parties: { slug: string; count: number }[];
};

const counted = <T extends z.ZodRawShape>(item: T) =>
  z.object({
    total: z.number().int().nonnegative(),
    items: z
      .array(
        z
          .object({ ...item, count: z.number().int().nonnegative() })
          .nullable()
          .catch(null),
      )
      .catch([]),
  });

const fresh = { next: { revalidate: 60 } };

export async function getTodayCounts(since: string): Promise<TodayCounts> {
  const query = `?since=${encodeURIComponent(since)}`;
  const [sources, parties] = await Promise.all([
    request(`/articles/sources${query}`, counted({ name: z.string().min(1) }), fresh).catch(() => null),
    request(`/articles/parties${query}`, counted({ slug: z.string().min(1) }), fresh).catch(() => null),
  ]);
  const most = <T extends { count: number }>(items: (T | null)[] | undefined) =>
    (items ?? []).filter((item): item is T => item !== null && item.count > 0).sort((a, b) => b.count - a.count);
  return {
    total: sources?.total ?? parties?.total ?? 0,
    sources: most(sources?.items),
    parties: most(parties?.items),
  };
}

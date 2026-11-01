import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getFeedPage, getParties } from "@/lib/api/client";
import { partyPath } from "@/lib/parties";
import { SITE_URL } from "@/lib/site";
import type { Article } from "@/lib/types";

const MAX_PAGES = 10;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const home = { url: SITE_URL, changeFrequency: "hourly" as const };
  try {
    const parties = await getParties();
    const articles: Article[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { articles: batch, nextCursor } = await getFeedPage({ cursor, limit: 50 });
      articles.push(...batch);
      if (!nextCursor) break;
      cursor = nextCursor;
    }
    return [
      home,
      ...parties.map((party) => ({ url: `${SITE_URL}${partyPath(party.slug)}` })),
      ...articles.map((article) => ({
        url: `${SITE_URL}/article/${article.id}`,
        lastModified: article.publishedAt,
      })),
    ];
  } catch {
    return [home];
  }
}

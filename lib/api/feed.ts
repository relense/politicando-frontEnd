import { FEATURES } from "@/lib/features";
import { apiOrder, type FeedOrder } from "@/lib/feedFilter";
import type { ArticlePage } from "@/lib/types";
import { getFeedPage } from "./client";
import { getStories, type StoryPage, type StorySort } from "./stories";

export type FeedQueryInput = {
  party?: string | string[];
  q?: string;
  source?: string | string[];

  cursor?: string;
  limit?: number;
};

/** A page of the news feed: stories once the API groups them (FEATURES.stories), articles until then. */
export function loadFeed(query: FeedQueryInput, order: FeedOrder, stories: boolean = FEATURES.stories): Promise<ArticlePage | StoryPage> {
  const { sort, period, days } = apiOrder(order);
  if (stories) return getStories({ ...query, sort: sort as StorySort | undefined, period });
  return getFeedPage({ ...query, sort: sort === "coverage" ? undefined : sort, period, days });
}

/** How many news the feed would show. */
export const totalOf = (page: ArticlePage | StoryPage) => ("stories" in page ? page.total : (page.total ?? null));

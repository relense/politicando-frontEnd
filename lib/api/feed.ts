import { FEATURES } from "@/lib/features";
import { apiOrder, type FeedOrder } from "@/lib/feedFilter";
import type { ArticlePage } from "@/lib/types";
import { getFeedPage } from "./client";
import { getStories, type StoryPage, type StorySort } from "./stories";

/** `tag`: only stories with this tag ("oe2027"); articles have none, so it's ignored without stories. */
export type FeedQueryInput = {
  party?: string | string[];
  q?: string;
  source?: string | string[];
  tag?: string;
  cursor?: string;
  limit?: number;
};

/** A page of the news feed: stories once the API groups them (FEATURES.stories), articles until then. */
export function loadFeed(query: FeedQueryInput, order: FeedOrder, stories: boolean = FEATURES.stories): Promise<ArticlePage | StoryPage> {
  const { sort, period, days } = apiOrder(order);
  const { tag, ...rest } = query;
  if (stories) return getStories({ ...rest, tag, sort: sort as StorySort | undefined, period });
  return getFeedPage({ ...rest, sort: sort === "coverage" ? undefined : sort, period, days });
}

/** How many news the feed would show. */
export const totalOf = (page: ArticlePage | StoryPage) => ("stories" in page ? page.total : (page.total ?? null));

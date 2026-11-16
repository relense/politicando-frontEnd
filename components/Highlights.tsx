import { getEditorial } from "@/lib/api/client";
import { localPosts } from "@/lib/localPosts";
import type { EditorialPost } from "@/lib/types";

const COUNT = 4;

const newestFirst = (a: EditorialPost, b: EditorialPost) => b.publishedAt.localeCompare(a.publishedAt);

/**
 * What the moderators featured (the "featured" mark in the admin), newest first, topped up with the latest posts.
 * The first one is the highlight, the same on the front page and at the top of the blog.
 */
export async function loadHighlights(): Promise<EditorialPost[]> {
  const own = localPosts({ featured: true });
  try {
    const featured = [...(await getEditorial({ featured: true, limit: COUNT })).items, ...own].sort(newestFirst);
    if (featured.length >= COUNT) return featured.slice(0, COUNT);
    const latest = (await getEditorial({ limit: COUNT * 2 })).items.filter((post) => !featured.some((item) => item.id === post.id));
    return [...featured, ...[...latest, ...localPosts({ featured: false })].sort(newestFirst)].slice(0, COUNT);
  } catch {
    return own.slice(0, COUNT);
  }
}

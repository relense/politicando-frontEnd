import { getEditorial } from "@/lib/api/client";
import { localPosts } from "@/lib/localPosts";
import type { EditorialPost } from "@/lib/types";

const COUNT = 4;

/** What the moderators featured and our own featured explainers, topped up with the latest posts. */
export async function loadHighlights(): Promise<EditorialPost[]> {
  const own = localPosts({ featured: true });
  try {
    const featured = [...(await getEditorial({ featured: true, limit: COUNT })).items, ...own];
    if (featured.length >= COUNT) return featured.slice(0, COUNT);
    const latest = (await getEditorial({ limit: COUNT * 2 })).items.filter((post) => !featured.some((item) => item.id === post.id));
    return [...featured, ...latest].slice(0, COUNT);
  } catch {
    return own.slice(0, COUNT);
  }
}

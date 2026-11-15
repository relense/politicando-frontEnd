import Link from "next/link";
import { getEditorial } from "@/lib/api/client";
import { localPosts } from "@/lib/localPosts";
import type { EditorialPost } from "@/lib/types";
import { EditorialCard } from "./EditorialCard";

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

/** Our own posts, four at most, above the news. */
export function Highlights({ posts }: { posts: EditorialPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="destaques" className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
        <h2 id="destaques" className="font-mono text-xs font-bold uppercase tracking-widest">
          Destaques
        </h2>
        <Link href="/editorial" className="font-mono text-xs text-link underline">
          Ver o blog
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <li key={post.id}>
            <EditorialCard post={post} compact heading="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}

import { getEditorialPost } from "@/lib/api/client";
import { KIND_LABELS } from "@/lib/editorial";
import { localPost } from "@/lib/localPosts";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";
import { decodeParam } from "@/lib/format";

export const alt = "Publicação do blog do Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once per post and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;
export const generateStaticParams = async () => [];

/** The cover as a data URL, or null: a cover that fails to load must not break the card. */
async function coverOf(url: string | null): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpeg|gif)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeParam((await params).slug);
  const post = slug === null ? null : (localPost(slug) ?? (await getEditorialPost(slug).catch(() => null)));
  if (!post) return ogCard({ kicker: "Blog", title: "Artigos, opinião e podcasts sobre política portuguesa" });
  return ogCard({
    kicker: `Blog · ${KIND_LABELS[post.kind]}`,
    title: post.title,
    subtitle: post.authorName ?? null,
    image: await coverOf(post.coverImageUrl),
  });
}

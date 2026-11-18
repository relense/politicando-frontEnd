import { getArticle } from "@/lib/api/client";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";
import { partyColor } from "@/lib/parliament";

export const alt = "Notícia no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once per page and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;
export const generateStaticParams = async () => [];

/** Our own card with the outlet's name and headline: the outlet's photo is theirs to share, not ours. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = /^\d+$/.test(id) ? await getArticle(Number(id)).catch(() => null) : null;
  if (!article) return ogCard({ kicker: "Notícias", title: "As notícias sobre os partidos portugueses, num só lugar" });
  const party = article.parties[0];
  return ogCard({
    kicker: `Notícia · ${article.source}`,
    title: article.title,
    color: party ? partyColor(party.slug) : undefined,
    badge: article.parties.length === 1 ? party!.acronym : null,
  });
}

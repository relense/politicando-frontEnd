import { getParties } from "@/lib/api/client";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";
import { partyColor } from "@/lib/parliament";
import { findPartyByParam } from "@/lib/parties";

export const alt = "Partido no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once per page and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;
export const generateStaticParams = async () => [];

export default async function Image({ params }: { params: Promise<{ name: string }> }) {
  const party = findPartyByParam(await getParties().catch(() => []), (await params).name);
  if (!party) return ogCard({ kicker: "Partidos", title: "Os partidos políticos portugueses" });
  return ogCard({
    kicker: "Partido",
    title: party.name,
    subtitle: "Notícias, deputados, votações e propostas",
    color: partyColor(party.slug),
    badge: party.acronym,
  });
}

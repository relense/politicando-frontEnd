import { getParties } from "@/lib/api/client";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";
import { partyColor } from "@/lib/parliament";
import { findPartyByParam } from "@/lib/parties";

export const alt = "Partido no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

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

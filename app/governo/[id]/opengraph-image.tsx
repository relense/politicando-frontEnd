import { getGovernmentMember, getParties } from "@/lib/api/client";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";
import { partyColor } from "@/lib/parliament";

export const alt = "Membro do Governo no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = /^[0-9a-f]{32}$/.test(id) ? await getGovernmentMember(id).catch(() => null) : null;
  if (!member) return ogCard({ kicker: "Governo", title: "O Governo de Portugal: Primeiro-Ministro e ministros" });
  const party = member.partySlug ? (await getParties().catch(() => [])).find((item) => item.slug === member.partySlug) : undefined;
  return ogCard({
    kicker: "Governo",
    title: member.name,
    subtitle: member.positions[0]?.title ?? null,
    color: member.partySlug ? partyColor(member.partySlug) : undefined,
    badge: party?.acronym ?? (member.independent ? "IND" : null),
  });
}

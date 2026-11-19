import { getDeputy } from "@/lib/api/client";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";
import { partyColor } from "@/lib/parliament";

export const alt = "Deputado no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once per page and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;
export const generateStaticParams = async () => [];

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deputy = /^\d+$/.test(id) ? await getDeputy(Number(id)).catch(() => null) : null;
  if (!deputy) return ogCard({ kicker: "Parlamento", title: "Os 230 deputados da Assembleia da República" });
  return ogCard({
    kicker: "Parlamento · Deputado",
    title: deputy.name,
    subtitle: `${deputy.party ? `${deputy.party.name} · ` : ""}Eleito por ${deputy.constituency}`,
    color: deputy.party ? partyColor(deputy.party.slug) : undefined,
    badge: deputy.party?.acronym,
  });
}

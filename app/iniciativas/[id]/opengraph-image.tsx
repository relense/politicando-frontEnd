import { getInitiative } from "@/lib/api/client";
import { headlineOf } from "@/lib/initiatives";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";

export const alt = "Iniciativa no Parlamento, no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initiative = /^\d{1,9}$/.test(id) ? await getInitiative(Number(id)).catch(() => null) : null;
  if (!initiative) return ogCard({ kicker: "Iniciativas", title: "As leis e propostas no Parlamento, explicadas" });
  return ogCard({
    kicker: `Parlamento · ${initiative.plain?.type.label ?? initiative.type}`,
    title: headlineOf(initiative),
    subtitle: initiative.plain?.status.label ?? null,
  });
}

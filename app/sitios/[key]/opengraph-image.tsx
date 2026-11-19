import { getPlaceDetail } from "@/lib/api/places";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";

export const alt = "Quem governa este sítio, no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once per page and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;
export const generateStaticParams = async () => [];

const KICKERS: Record<string, string> = { district: "Distrito", municipality: "Concelho", parish: "Freguesia" };

export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  const place = await getPlaceDetail((await params).key).catch(() => null);
  if (!place) return ogCard({ kicker: "Autarquias", title: "Quem governa cada concelho e freguesia" });
  return ogCard({
    kicker: KICKERS[place.level] ?? "Sítio",
    title: place.name,
    subtitle: "Quem governa, os deputados eleitos, as eleições e os contratos públicos",
  });
}

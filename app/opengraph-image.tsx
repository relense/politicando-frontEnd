import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";

export const alt = "Politicando: as notícias dos partidos portugueses";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** The site's preview, for every page without one of its own. */
export default function Image() {
  return ogCard({
    kicker: "Política portuguesa",
    title: "Os partidos, o Parlamento e as eleições, num só lugar",
    subtitle: "Lê, compara e comenta.",
  });
}

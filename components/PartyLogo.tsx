import Image from "next/image";
import { getPartyLogo } from "@/lib/parties";

/** Parties without a known logo get a neutral badge. Never fall back to another party's logo. */
export function PartyLogo({ slug, acronym, size }: { slug: string; acronym: string; size: number }) {
  const logo = getPartyLogo(slug);

  if (!logo) {
    return (
      <span
        aria-hidden="true"
        data-testid="party-badge"
        style={{ width: size, height: size, fontSize: Math.max(8, size / 3.2) }}
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface font-mono font-bold text-muted"
      >
        {acronym.slice(0, 3)}
      </span>
    );
  }

  return (
    <Image
      src={`/parties/${logo}`}
      alt={`Logótipo ${acronym}`}
      aria-hidden="true"
      width={size}
      height={size}
      // Many logos are dark text on transparency; a white tile keeps them legible in the dark theme.
      className="shrink-0 object-contain dark:rounded-sm dark:bg-white dark:p-0.5"
      style={{ width: size, height: size }}
    />
  );
}

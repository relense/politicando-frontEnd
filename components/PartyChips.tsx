import Link from "next/link";
import { partyPath } from "@/lib/parties";
import type { ArticleParty } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";

export function PartyChips({ parties, className = "" }: { parties: ArticleParty[]; className?: string }) {
  if (parties.length === 0) return null;
  return (
    <ul aria-label="Partidos mencionados" className={`flex flex-wrap gap-2 ${className}`}>
      {parties.map((party) => (
        <li key={party.slug}>
          <Link
            href={partyPath(party.slug)}
            className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-1.5 pr-3 font-mono text-xs hover:bg-surface"
          >
            <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
            {party.acronym}
          </Link>
        </li>
      ))}
    </ul>
  );
}

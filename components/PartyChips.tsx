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
            className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3.5 font-mono text-sm font-bold hover:bg-surface"
          >
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
              <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
            </span>
            {party.acronym}
          </Link>
        </li>
      ))}
    </ul>
  );
}

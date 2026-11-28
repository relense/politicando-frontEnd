import Link from "next/link";
import { partyPath } from "@/lib/parties";
import type { ArticleParty } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";

export function PartyChips({ parties, className = "" }: { parties: ArticleParty[]; className?: string }) {
  if (parties.length === 0) return null;
  return (
    <ul aria-label="Partidos mencionados" className={`flex flex-wrap gap-1.5 ${className}`}>
      {parties.map((party) => (
        <li key={party.slug}>
          <Link
            prefetch={false}
            href={partyPath(party.slug)}
            className="flex h-[30px] items-center gap-1.5 rounded-full border border-[var(--chip-line)] pl-[3px] pr-2.5 font-mono text-xs font-medium hover:bg-[var(--button)]"
          >
            <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
              <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
            </span>
            {party.acronym}
          </Link>
        </li>
      ))}
    </ul>
  );
}

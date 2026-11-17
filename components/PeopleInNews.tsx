import Link from "next/link";
import { localOfficialPath } from "@/lib/api/localOfficials";
import type { PersonMention } from "@/lib/types";

/** Where each person named in the news has their page. */
export function mentionHref(person: PersonMention): string {
  if (person.kind === "deputy") return `/deputados/${encodeURIComponent(person.id)}`;
  if (person.kind === "government") return `/governo/${encodeURIComponent(person.id)}`;
  if (person.kind === "local") return localOfficialPath(person.id);
  return "/presidente";
}

/** "Pessoas na notícia": everyone named in it who has a page here, each linked to it. Hidden when there's no one. */
export function PeopleInNews({ people, className = "" }: { people: PersonMention[]; className?: string }) {
  if (people.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-mono text-xs text-muted">Pessoas na notícia</span>
      <ul className="flex flex-wrap gap-2">
        {people.map((person) => (
          <li key={`${person.kind}-${person.id}`}>
            <Link
              href={mentionHref(person)}
              className="inline-flex h-[30px] items-center rounded-full border border-[var(--chip-line)] px-3 text-[13px] hover:bg-[var(--button)]"
            >
              {person.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

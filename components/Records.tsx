import Link from "next/link";
import type { CasePerson, CaseSummary, Term } from "@/lib/api/cases";
import type { PersonKind, PersonRecords } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { reviewedLabel, statusNote } from "@/lib/records";

/** A stage or status as we label it, with its plain meaning one press away ("o que significa?"). */
export function TermLabel({ term, className = "" }: { term: Term; className?: string }) {
  if (!term.plain) return <span className={className}>{term.label}</span>;
  return (
    <details className={`group inline-block align-baseline ${className}`}>
      <summary className="inline cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {term.label}{" "}
        <span className="font-mono text-xs font-normal text-link underline">
          o que significa?<span className="sr-only"> ({term.label})</span>
        </span>
      </summary>
      <span className="mt-1 block max-w-prose rounded-lg bg-surface p-2 text-sm font-normal text-ink">{term.plain}</span>
    </details>
  );
}

/** A person's own status in a case, always with the note the law asks for (presumption of innocence). */
export function PersonStatus({ status, final }: { status: Pick<Term, "key" | "label"> & { plain?: string | null }; final: boolean }) {
  const note = statusNote(status.key, final);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="font-bold">{status.label}</span>
      {note && <span className="font-mono text-xs text-muted">({note})</span>}
    </span>
  );
}

function PersonLine({ person }: { person: CasePerson }) {
  const href =
    person.deputyId !== null ? `/deputados/${person.deputyId}` : person.governmentMemberId ? `/governo/${person.governmentMemberId}` : null;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      {href ? (
        <Link href={href} className="font-bold underline">
          {person.name}
        </Link>
      ) : (
        <span className="font-bold">{person.name}</span>
      )}
      {(person.roleAtTime || person.party) && (
        <span className="inline-flex items-center gap-1.5 text-muted">
          {person.party && (
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(person.party.slug) }} />
          )}
          {[person.roleAtTime, person.party && `${person.party.acronym} à data`].filter(Boolean).join(" · ")}
        </span>
      )}
      <span aria-hidden="true" className="text-muted">
        —
      </span>
      <PersonStatus status={person.status} final={person.final} />
      {person.outcome && <span className="text-muted">· {person.outcome}</span>}
    </li>
  );
}

export function CasePeople({ people }: { people: CasePerson[] }) {
  return (
    <ul className="space-y-1.5">
      {people.map((person, index) => (
        <PersonLine key={`${person.name}-${index}`} person={person} />
      ))}
    </ul>
  );
}

/** One case in the record: its stage, the crimes in question, the people and how fresh the entry is. */
export function CaseCard({ item, heading = "h2" }: { item: CaseSummary; heading?: "h2" | "h3" }) {
  const Heading = heading;
  return (
    <article className="rounded-2xl border border-line p-5">
      <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted">
        {item.crimes.map((crime) => (
          <span key={crime.key}>{crime.label}</span>
        ))}
      </p>
      <Heading className="mt-1 text-xl font-bold leading-snug">
        <Link href={`/registo/${item.id}`} className="hover:underline">
          {item.title}
        </Link>
      </Heading>
      <p className="mt-2 text-sm">
        <span className="text-muted">Fase do processo: </span>
        <TermLabel term={item.status} className="font-bold" />
        {item.statusDate && <span className="text-muted"> · desde {formatDate(item.statusDate)}</span>}
      </p>
      {item.people.length > 0 && (
        <div className="mt-3">
          <CasePeople people={item.people} />
        </div>
      )}
      {item.reviewedAt && <p className="mt-3 font-mono text-xs text-muted">{reviewedLabel(item.reviewedAt)}</p>}
    </article>
  );
}

/**
 * "Registo" on a person's page: their published cases, each with their own status and its note, and a link to
 * their declared interests. Nothing at all when there is neither.
 */
export function RecordsBox({ records, kind, id }: { records: PersonRecords; kind: PersonKind; id: string | number }) {
  if (records.cases.length === 0 && records.interests === 0) return null;
  const filter = kind === "deputy" ? `deputado=${id}` : kind === "government" ? `membro=${id}` : null;
  return (
    <section aria-labelledby="registo-titulo" className="mt-10 rounded-2xl border border-line p-5">
      <h2 id="registo-titulo" className="font-mono text-sm font-bold uppercase tracking-widest">
        Registo
      </h2>
      {records.cases.length > 0 && (
        <ul className="mt-3 space-y-3">
          {records.cases.map((item) => (
            <li key={item.id}>
              <Link href={`/registo/${item.id}`} className="font-bold underline">
                {item.title}
              </Link>
              <p className="text-sm">
                <PersonStatus status={item.personStatus} final={item.final} />
                <span className="text-muted"> · fase do processo: {item.status.label}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      {records.interests > 0 && filter && (
        <Link href={`/interesses?${filter}`} className="mt-3 inline-block font-mono text-sm text-link underline">
          Interesses declarados ({records.interests}) →
        </Link>
      )}
      <p className="mt-3 font-mono text-xs text-muted">
        Factos públicos com fontes. Ninguém é culpado até haver condenação transitada em julgado.{" "}
        <Link href="/registo" className="underline">
          Sobre o registo
        </Link>
      </p>
    </section>
  );
}

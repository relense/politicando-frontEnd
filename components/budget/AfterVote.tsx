import Link from "next/link";
import type { BudgetAfterVote, BudgetImplementation } from "@/lib/api/budget";
import { IMPLEMENTATION_TONES, implementationLabel } from "@/lib/budget";
import { formatDate, formatNumber } from "@/lib/format";
import { ToneBadge } from "./BudgetParts";

/**
 * After the vote (backend docs/budget-api.md, "After the vote"): what the Government announced about approved proposals,
 * recorded by hand by the team. Shown as written, dated, with «segundo {source}»; never worded as a fact we checked.
 */

const label = "font-mono text-[11px] font-bold uppercase tracking-widest";

/** «segundo publico.pt», linking the source when there's a web link. */
function Source({ name, url }: { name: string; url: string | null }) {
  return (
    <>
      segundo{" "}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
          {name}
          <span className="sr-only"> (abre num novo separador)</span>
        </a>
      ) : (
        name
      )}
    </>
  );
}

/** The year's «Depois da votação»: each announcement, newest first, and the list of the proposals said not to be applied. */
export function AfterVoteSection({ notes, notApplied, href }: { notes: BudgetAfterVote[]; notApplied: number; href: string }) {
  if (notes.length === 0) return null;
  return (
    <section aria-labelledby="depois-da-votacao" className="mb-8 rounded-2xl border border-line p-4">
      <h2 id="depois-da-votacao" className={`${label} text-muted`}>
        Depois da votação
      </h2>
      <ul className="mt-2 flex flex-col gap-3">
        {notes.map((note, index) => (
          <li key={`${note.date}-${index}`}>
            <p className="text-sm leading-snug [overflow-wrap:anywhere]">{note.text}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {formatDate(note.date)} · <Source name={note.sourceName} url={note.sourceUrl} />
            </p>
          </li>
        ))}
      </ul>
      {notApplied > 0 && (
        <Link href={href} className="mt-3 inline-block font-mono text-xs font-bold underline">
          {notApplied === 1
            ? "A proposta que o Governo diz que não vai aplicar"
            : `As ${formatNumber(notApplied)} propostas que o Governo diz que não vai aplicar`}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}

/** Beside the result in the list. */
export const ImplementationBadge = ({ implementation }: { implementation: BudgetImplementation | null }) =>
  implementation ? (
    <ToneBadge tone={IMPLEMENTATION_TONES[implementation.status]}>{implementationLabel(implementation.status)}</ToneBadge>
  ) : null;

/** On the proposal's page: the status, its note, when it was announced and the source. */
export function ImplementationSection({ implementation }: { implementation: BudgetImplementation | null }) {
  if (!implementation) return null;
  return (
    <section aria-labelledby="depois-da-votacao" className="mt-4 rounded-xl border border-line px-4 py-3">
      <h2 id="depois-da-votacao" className={`${label} text-muted`}>
        Depois da votação
      </h2>
      <p className="mt-1">
        <ImplementationBadge implementation={implementation} />
      </p>
      {implementation.note && <p className="mt-1 text-sm leading-snug [overflow-wrap:anywhere]">{implementation.note}</p>}
      <p className="mt-1 font-mono text-[11px] text-muted">
        {formatDate(implementation.date)} · <Source name={implementation.sourceName} url={implementation.sourceUrl} />
      </p>
    </section>
  );
}

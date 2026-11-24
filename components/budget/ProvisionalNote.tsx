import type { BudgetBillVote } from "@/lib/api/budget";
import { provisionalNote } from "@/lib/budget";

/** Under a Budget vote the team added from the news: provisional until the parliament publishes it, with its source. */
export function ProvisionalNote({ vote, className = "" }: { vote: BudgetBillVote; className?: string }) {
  const note = provisionalNote(vote);
  if (!note) return null;
  // The note's own words, with the source's name as the link.
  const name = vote.source?.name ?? "";
  const [before, ...after] = note.text.split(name);
  return (
    <p className={`font-mono text-[11px] text-muted ${className}`}>
      {note.url && name ? (
        <>
          {before}
          <a href={note.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {name}
            <span className="sr-only"> (abre num novo separador)</span>
          </a>
          {after.join(name)}
        </>
      ) : (
        note.text
      )}
    </p>
  );
}

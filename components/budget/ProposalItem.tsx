import Link from "next/link";
import type { BudgetProposal, BudgetVote } from "@/lib/api/budget";
import { authorsShort, nextPlanned, plannedLine } from "@/lib/budget";
import { formatDate } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { AmbiguityNote, ChoiceColumns, ResultBadge, VoteChips } from "./BudgetParts";
import { BudgetFollow } from "./BudgetFollow";

export const proposalPath = (proposal: Pick<BudgetProposal, "year" | "id">) => `/orcamento/${proposal.year}/proposta/${proposal.id}`;

/** «PSD · n.º 1260C · IRS · votada a 19-11-2026»: who proposed it, its number, topic and when it was voted. */
export function ProposalMeta({ proposal, today }: { proposal: BudgetProposal; today: string | null }) {
  const first = proposal.authors.parties[0];
  const when = proposal.lastVotedOn
    ? proposal.lastVotedOn === today
      ? "votada hoje"
      : `votada a ${formatDate(proposal.lastVotedOn)}`
    : "por votar";
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-muted">
      {first && <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: partyColor(first.slug) }} />}
      <span className="font-bold text-ink">{authorsShort(proposal.authors) || "—"}</span>
      <span>· n.º {proposal.number}</span>
      {proposal.topics[0] && <span>· {proposal.topics.join(", ")}</span>}
      <span>· {when}</span>
    </p>
  );
}

/** Beside «PDF oficial» when a model wrote the summary from it. */
export const AutomaticLabel = ({ proposal }: { proposal: BudgetProposal }) =>
  proposal.plain?.automatic ? <span className="self-center font-mono text-[11px] text-muted">Resumo automático</span> : null;

/** The vote that decided it: the last one (the plenary's, when called up). */
export const latestVote = (proposal: BudgetProposal): BudgetVote | null => proposal.votes[proposal.votes.length - 1] ?? null;

/** A part's own heading, when voted in parts. */
const partHeading = (vote: BudgetVote) =>
  [vote.parts.join("; "), vote.phase === "plenary" ? "Plenário" : vote.phase === "committee" ? "Comissão" : null, formatDate(vote.votedOn)]
    .filter(Boolean)
    .join(" · ");

/** Every vote of a proposal, each in three columns. */
export function ProposalVotes({ proposal }: { proposal: BudgetProposal }) {
  if (proposal.votes.length === 0) return <p className="text-sm text-muted">Ainda não foi votada.</p>;
  const split = proposal.votes.length > 1;
  return (
    <div className="flex flex-col gap-4">
      {proposal.votes.map((vote, index) => (
        <div key={index}>
          {split && (
            <p className="mb-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
              {partHeading(vote)}
              {vote.partLabel && <span className="font-bold text-ink">{vote.partLabel}</span>}
            </p>
          )}
          {vote.result === "superseded" || vote.parties.length === 0 ? (
            <p className="text-sm text-muted">
              {vote.result === "superseded" ? "Prejudicada: não chegou a ser votada." : "Sem votos por partido na fonte oficial."}
            </p>
          ) : (
            <ChoiceColumns vote={vote} />
          )}
          <AmbiguityNote vote={vote} />
        </div>
      ))}
    </div>
  );
}

/** «Prevista para votação hoje, em comissão»: while still to be voted, from the voting scripts (planned, not certain). */
export function PlannedLine({ proposal, today, className = "" }: { proposal: BudgetProposal; today: string | null; className?: string }) {
  const planned = nextPlanned(proposal, today);
  return planned ? <p className={`font-mono text-[11px] font-bold ${className}`}>{plannedLine(planned, today)}</p> : null;
}

/** The day's voting script (PDF), beside the official PDF. */
export function ScriptLink({ proposal, today }: { proposal: BudgetProposal; today: string | null }) {
  const planned = nextPlanned(proposal, today);
  if (!planned?.scriptUrl) return null;
  return (
    <a
      href={planned.scriptUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
    >
      Guião de votações <span aria-hidden="true">↗</span>
    </a>
  );
}

/** In the list: the line and the chips; opened in place, the votes in full and the links. */
export function ProposalItem({ proposal, today }: { proposal: BudgetProposal; today: string | null }) {
  const vote = latestVote(proposal);
  return (
    <details className="group border-b border-line py-3 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ProposalMeta proposal={proposal} today={today} />
            <h3 className="mt-0.5 font-serif text-lg font-bold leading-snug [overflow-wrap:anywhere]">{proposal.title}</h3>
            <PlannedLine proposal={proposal} today={today} className="mt-0.5" />
            {proposal.plain && (
              <p className="mt-1 text-sm leading-snug [overflow-wrap:anywhere]">
                <span className="mr-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">Resumo</span>
                {proposal.plain.summary}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ResultBadge result={proposal.result} />
            <span aria-hidden="true" className="font-mono text-[11px] text-muted">
              <span className="group-open:hidden">Abrir ▾</span>
              <span className="hidden group-open:inline">Fechar ▴</span>
            </span>
          </div>
        </div>
        {vote && vote.parties.length > 0 && <VoteChips vote={vote} label={`Como votou cada partido na proposta ${proposal.number}`} />}
      </summary>
      <div className="mt-3 rounded-xl border border-line p-3">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted">Votação</p>
        <ProposalVotes proposal={proposal} />
        <p className="mt-3 flex flex-wrap gap-2">
          <Link
            href={proposalPath(proposal)}
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
          >
            Página da proposta <span aria-hidden="true">→</span>
          </Link>
          <ScriptLink proposal={proposal} today={today} />
          <BudgetFollow proposal={proposal} />
          {proposal.documentUrl && (
            <a
              href={proposal.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
            >
              PDF oficial <span aria-hidden="true">↗</span>
            </a>
          )}
          <AutomaticLabel proposal={proposal} />
        </p>
      </div>
    </details>
  );
}

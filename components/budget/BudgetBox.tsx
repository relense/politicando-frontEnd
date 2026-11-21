import Link from "next/link";
import {
  getBudgetProposals,
  getBudgets,
  getBudgetSummary,
  type BudgetProposal,
  type BudgetSummary,
  type BudgetYear,
} from "@/lib/api/budget";
import { authorsShort, budgetBox, budgetTally, partyShort, sessionTime, type BudgetBox as BoxState } from "@/lib/budget";
import { formatDate, formatLongDate, formatNumber, lisbonDay } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { ProgressBar, ResultBadge, ToneBadge, VoteChips } from "./BudgetParts";
import { latestVote, proposalPath } from "./ProposalItem";

export type BudgetBoxData = { year: BudgetYear; summary: BudgetSummary; latest: BudgetProposal | null };

/** The current Budget, its summary and its latest vote; null when the API has none (the box is then left out). */
export async function loadBudgetBox(): Promise<BudgetBoxData | null> {
  const budgets = await getBudgets().catch(() => null);
  const year = budgets?.items.find((item) => item.proposals > 0) ?? null;
  if (!year) return null;
  const [summary, latest] = await Promise.all([
    getBudgetSummary(year.year).catch(() => null),
    getBudgetProposals(year.year, { limit: 1 })
      .then((page) => page.items.find((item) => item.votes.length > 0) ?? null)
      .catch(() => null),
  ]);
  return summary ? { year, summary, latest } : null;
}

/** Whether the box has something to show beside the news (see lib/budget budgetBox). */
export const showsBudgetBox = (data: BudgetBoxData | null, now: number): data is BudgetBoxData =>
  data !== null && budgetBox({ bills: data.year.bills, schedule: data.summary.schedule, pending: data.year.pending }, now) !== null;

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
/** «Quinta-feira, 20 de novembro», in Lisbon. */
function sessionDay(value: string) {
  const day = lisbonDay(value);
  if (!day) return null;
  const weekday = WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
  return `${weekday}, ${formatLongDate(day)?.replace(/ de \d{4}$/, "")}`;
}

const label = "font-mono text-[11px] font-bold uppercase tracking-widest";

/**
 * «Orçamento do Estado 2027»: votes counted, then (during a session) the session and the latest vote, (on a day
 * without votes) the next session and the last vote, or (after the final vote) the result. On the news for 7 days
 * after the final vote; `keep` on the Budget's own page, where `tally={false}` leaves out the count the page shows at the top.
 */
export function BudgetBox({
  data,
  now,
  keep = false,
  tally = true,
  headingId = "caixa-orcamento",
}: {
  data: BudgetBoxData;
  now: number;
  keep?: boolean;
  tally?: boolean;
  headingId?: string;
}) {
  const { year, summary, latest } = data;
  const box: BoxState | null = budgetBox({ bills: year.bills, schedule: summary.schedule, pending: year.pending }, now, { keep });
  if (!box) return null;
  // From the results, so the counts add up to the total.
  const { voted, pending, approved, rejected, total } = budgetTally(summary.results);
  const acronymOf = (slug: string) => {
    const party = summary.parties.find((entry) => entry.party.slug === slug)?.party;
    return party ? partyShort(party) : slug.toUpperCase();
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-line bg-[var(--card-hover)] p-4 [&>h2+div]:mt-2 [&>h2+div]:border-t-0 [&>h2+div]:pt-0"
    >
      <h2 id={headingId} className={label}>
        <Link href="/orcamento" className="hover:underline">
          Orçamento do Estado {year.year}
        </Link>
      </h2>
      {tally && (
        <>
          {box.state === "final" ? (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-serif text-3xl font-bold">{/^aprovad/i.test(box.final.result) ? "Aprovado" : "Chumbado"}</span>
              <span className="font-mono text-xs text-muted">
                a {formatDate(box.final.date)} · {formatNumber(voted)} propostas votadas
              </span>
            </p>
          ) : (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-serif text-3xl font-bold">{formatNumber(voted)}</span>
              <span className="font-mono text-xs text-muted">votadas · {formatNumber(pending)} por votar</span>
            </p>
          )}
          <div className="mt-2">
            <ProgressBar approved={approved} rejected={rejected} total={total} label="Propostas de alteração" />
            <p className="mt-1 flex gap-3 font-mono text-[11px] text-muted">
              <span>
                <span aria-hidden="true" style={{ color: "var(--favor)" }}>
                  ●
                </span>{" "}
                {formatNumber(approved)} aprovadas
              </span>
              <span>
                <span aria-hidden="true" style={{ color: "var(--contra)" }}>
                  ●
                </span>{" "}
                {formatNumber(rejected)} rejeitadas
              </span>
            </p>
          </div>
        </>
      )}

      {box.state === "session" && (
        <div className="mt-4 border-t border-line pt-3">
          <p className={label} style={{ color: "var(--contra)" }}>
            <span aria-hidden="true">● </span>Sessão de votação
          </p>
          <p className="mt-1 text-sm">
            <strong>Começou às {sessionTime(box.session.startsAt)}</strong> · {box.session.title}
          </p>
        </div>
      )}
      {box.state === "between" && box.next && (
        <div className="mt-4 border-t border-line pt-3">
          <p className={label} style={{ color: "var(--link)" }}>
            Próximo dia de votações
          </p>
          <p className="mt-1 font-serif text-lg font-bold leading-snug">{sessionDay(box.next.startsAt)}</p>
          <p className="font-mono text-[11px] text-muted">segundo a agenda do Parlamento</p>
        </div>
      )}

      {box.state === "final" ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="flex items-center justify-between gap-2">
            <span className={`${label} text-muted`}>Votação final global</span>
            <ToneBadge tone={/^aprovad/i.test(box.final.result) ? "approved" : "rejected"}>{box.final.result}</ToneBadge>
          </p>
          <ul aria-label="Como votou cada partido na votação final global" className="mt-2 flex flex-wrap gap-1">
            {(
              [
                ["favor", box.final.favor, "✓", "var(--favor)"],
                ["abstention", box.final.abstention, "–", "var(--muted)"],
                ["against", box.final.against, "×", "var(--contra)"],
              ] as const
            ).flatMap(([key, items, mark, color]) =>
              items.map((item) => (
                <li
                  key={`${key}-${item.partySlug}`}
                  className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold"
                  style={{
                    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                  }}
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: partyColor(item.partySlug) }} />
                  <span aria-hidden="true" style={{ color }}>
                    {mark}
                  </span>
                  {acronymOf(item.partySlug)}
                  <span className="sr-only">: {key === "favor" ? "a favor" : key === "against" ? "contra" : "abstenção"}</span>
                </li>
              )),
            )}
          </ul>
          <Link href="/orcamento" className="mt-3 inline-block font-mono text-xs font-bold underline">
            Ver o resumo do orçamento <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        latest && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="flex items-center justify-between gap-2">
              <span className={`${label} text-muted`}>
                {box.state === "session" || latest.lastVotedOn === lisbonDay(new Date(now).toISOString())
                  ? "Última votação"
                  : `Última votação · ${formatDate(latest.lastVotedOn)}`}
              </span>
              <ResultBadge result={latest.result} />
            </p>
            <Link href={proposalPath(latest)} className="mt-1 block font-serif text-base font-bold leading-snug hover:underline">
              {latest.title}
            </Link>
            <p className="mb-2 font-mono text-[11px] text-muted">
              {authorsShort(latest.authors) ? `${authorsShort(latest.authors)} · ` : ""}n.º {latest.number}
            </p>
            {latestVote(latest) && <VoteChips vote={latestVote(latest)!} label={`Como votou cada partido na proposta ${latest.number}`} />}
            <Link
              href={latest.lastVotedOn ? `/orcamento?dia=${latest.lastVotedOn}#propostas` : "/orcamento#propostas"}
              className="mt-3 inline-block font-mono text-xs font-bold underline"
            >
              {latest.lastVotedOn === lisbonDay(new Date(now).toISOString())
                ? "Ver as votações de hoje"
                : `Ver o que se votou a ${formatDate(latest.lastVotedOn)}`}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )
      )}
    </section>
  );
}

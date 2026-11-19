import type { BudgetBill, BudgetChoice, BudgetParty, BudgetProposal, BudgetResult, BudgetSession, BudgetVote } from "@/lib/api/budget";
import { tidyName } from "@/lib/elections";
import { formatDate, formatTime, lisbonDay } from "@/lib/format";
import type { Vote } from "@/lib/types";

/** The State Budget pages' rules: wording in the parliament's neutral terms, never "won" or "lost". */

export const RESULT_LABELS: Record<BudgetResult, string> = {
  pending: "Por votar",
  sent_to_plenary: "Avocada pelo Plenário",
  approved: "Aprovada",
  partially_approved: "Aprovada em parte",
  rejected: "Rejeitada",
  withdrawn: "Retirada",
  not_admitted: "Não admitida",
  superseded: "Prejudicada",
  unclear: "Por esclarecer",
};
export type Tone = "approved" | "rejected" | "pending" | "neutral";
export const RESULT_TONES: Record<BudgetResult, Tone> = {
  pending: "pending",
  sent_to_plenary: "pending",
  approved: "approved",
  partially_approved: "approved",
  rejected: "rejected",
  withdrawn: "neutral",
  not_admitted: "neutral",
  superseded: "neutral",
  unclear: "neutral",
};
export const CHOICE_LABELS: Record<BudgetChoice, string> = {
  favor: "a favor",
  against: "contra",
  abstention: "abstenção",
  absent: "ausente",
};
/** The vote's own colour (the party's colour only marks who). */
export const CHOICE_COLORS: Record<BudgetChoice, string> = {
  favor: "var(--favor)",
  against: "var(--contra)",
  abstention: "var(--muted)",
  absent: "var(--line)",
};

/** In lists: the acronym, unless it's one letter nobody reads («L»): then the name as the party writes it («LIVRE»). */
export const partyShort = (party: Pick<BudgetParty, "acronym" | "name">) =>
  party.acronym.length > 1 ? party.acronym : party.name.toLocaleUpperCase("pt");
/** On a proposal's page: the name, written normally («Livre», «Partido Social Democrata»). */
export const partyFull = (party: Pick<BudgetParty, "name">) => tidyName(party.name);

/** Who proposed it, short: parties as `partyShort`, then deputies named without a group; the source's label as a last resort. */
export function authorsShort(authors: BudgetProposal["authors"]): string {
  const names = [...authors.parties.map(partyShort), ...authors.deputies];
  return names.length > 0 ? names.join(", ") : (authors.label ?? "");
}

/** The heading: «O que muda» when written, with the official title (often just which paragraphs change) under it. */
export function proposalHeading(proposal: Pick<BudgetProposal, "title" | "plain">): { main: string; official: string | null } {
  return proposal.plain ? { main: proposal.plain.summary, official: proposal.title } : { main: proposal.title, official: null };
}

/** «Votada a 19-11-2026, em Comissão»: the last vote, which decided it. */
export function votedLine(proposal: { votes: { votedOn: string | null; phase: "committee" | "plenary" | null }[] }): string | null {
  const last = proposal.votes.findLast((vote) => vote.votedOn);
  if (!last) return null;
  const where = last.phase === "plenary" ? ", no Plenário" : last.phase === "committee" ? ", em Comissão" : "";
  return `Votada a ${formatDate(last.votedOn)}${where}`;
}

export type PartyLine = {
  key: string;
  label: string;
  slug: string | null;
  vote: BudgetChoice | null;
  apart: { deputy: string; vote: BudgetChoice | null }[];
};

/** Each group's line in the source's order, with its deputies who voted apart under it; independents on their own line. */
export function partyLines(vote: BudgetVote): PartyLine[] {
  const lines: PartyLine[] = [];
  for (const line of vote.parties) {
    if (line.deputy && line.party) continue;
    lines.push(
      line.party
        ? { key: line.party.slug, label: partyShort(line.party), slug: line.party.slug, vote: line.vote, apart: [] }
        : { key: line.deputy ?? line.group, label: line.deputy ?? line.group, slug: null, vote: line.vote, apart: [] },
    );
  }
  for (const line of vote.parties) {
    if (!line.deputy || !line.party) continue;
    const group = lines.find((entry) => entry.slug === line.party!.slug);
    if (group) group.apart.push({ deputy: line.deputy, vote: line.vote });
    else
      lines.push({
        key: line.deputy,
        label: `${line.deputy} (${partyShort(line.party)})`,
        slug: line.party.slug,
        vote: line.vote,
        apart: [],
      });
  }
  return lines;
}

/** Who voted each way («A favor: PSD · IL»), by group. */
export function byChoice(vote: BudgetVote): Record<BudgetChoice, string[]> {
  const out: Record<BudgetChoice, string[]> = { favor: [], abstention: [], against: [], absent: [] };
  for (const line of partyLines(vote)) if (line.vote) out[line.vote].push(line.label);
  return out;
}

/** A party's votes on others' proposals as whole percentages, absences left out; null with none. */
export function choiceShares(votes: Record<BudgetChoice, number>): { favor: number; abstention: number; against: number } | null {
  const total = votes.favor + votes.abstention + votes.against;
  if (total === 0) return null;
  const favor = Math.round((votes.favor / total) * 100);
  const abstention = Math.round((votes.abstention / total) * 100);
  return { favor, abstention, against: 100 - favor - abstention };
}

const GENERAL = /generalidade/i;
const FINAL = /final global/i;
const passed = (vote: Vote) => /^aprovad/i.test(vote.result);

/** The bill that counts: the latest (2022 had one rejected in 2021 and one approved). */
const currentBill = (bills: BudgetBill[]) => bills[bills.length - 1] ?? null;

/** The Budget's own votes, from its bill's record (the parliament's terms for the phase). */
export function headlineVotes(bills: BudgetBill[]): { general: Vote | null; final: Vote | null } {
  const votes = currentBill(bills)?.votes ?? [];
  return {
    general: votes.findLast((vote) => GENERAL.test(vote.phase ?? "")) ?? null,
    final: votes.findLast((vote) => FINAL.test(vote.phase ?? "")) ?? null,
  };
}

/** The badge beside the title. */
export function budgetStage(bills: BudgetBill[]): { label: string; tone: Tone } | null {
  const bill = currentBill(bills);
  if (!bill) return null;
  const { general, final } = headlineVotes(bills);
  if (final)
    return passed(final) ? { label: "Aprovado", tone: "approved" } : { label: "Chumbado na votação final global", tone: "rejected" };
  if (general && !passed(general)) return { label: "Chumbado na generalidade", tone: "rejected" };
  if (bill.status === "approved") return { label: "Aprovado", tone: "approved" };
  if (bill.status === "rejected") return { label: "Chumbado", tone: "rejected" };
  if (bill.status === "withdrawn") return { label: "Retirado", tone: "neutral" };
  if (bill.status === "lapsed") return { label: "Caducado", tone: "neutral" };
  return general ? { label: "Em especialidade", tone: "pending" } : { label: "Em discussão", tone: "pending" };
}

/** After the final vote, the box stays on the news this long. */
const FINAL_SHOWN_DAYS = 7;

export type BudgetBox =
  { state: "session"; session: BudgetSession } | { state: "between"; next: BudgetSession | null } | { state: "final"; final: Vote };

/**
 * The Budget's box (on its page and beside the news), while it's being voted:
 * - "session": a Budget voting session began today (the API's `started`, or the clock when an older API doesn't say;
 *   it never says when one ends, nor which proposal is on the floor, so we say when it began, not that it's running);
 * - "between": otherwise, with the next session if one is scheduled;
 * - "final": after the final overall vote, for 7 days beside the news (`keep`: for good, on the Budget's page).
 * Null when there's nothing to follow.
 */
export function budgetBox(
  { bills, schedule, pending }: { bills: BudgetBill[]; schedule: BudgetSession[]; pending: number },
  now: number,
  { keep = false }: { keep?: boolean } = {},
): BudgetBox | null {
  const { final } = headlineVotes(bills);
  if (final) {
    const until = final.date ? Date.parse(`${final.date.slice(0, 10)}T23:59:59Z`) + FINAL_SHOWN_DAYS * 86_400_000 : 0;
    return keep || now <= until ? { state: "final", final } : null;
  }
  if (pending === 0 && schedule.length === 0) return null;
  const today = lisbonDay(new Date(now).toISOString());
  const started = schedule.find(
    (item) => !item.allDay && (item.started ?? Date.parse(item.startsAt) <= now) && lisbonDay(item.startsAt) === today,
  );
  if (started) return { state: "session", session: started };
  return { state: "between", next: schedule.find((item) => Date.parse(item.startsAt) > now) ?? null };
}

/** The session that ends with the final overall vote, once the parliament's agenda shows it. */
export const finalVoteSession = (schedule: BudgetSession[]): BudgetSession | null =>
  schedule.find((item) => item.stage === "final_vote") ?? null;

/** «10h00», in Lisbon's time. */
export const sessionTime = (value: string): string | null => formatTime(value)?.replace(":", "h") ?? null;

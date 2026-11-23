import type {
  BudgetBill,
  BudgetChoice,
  BudgetPlanned,
  BudgetParty,
  BudgetProposal,
  BudgetResult,
  BudgetSession,
  BudgetSessionStage,
  BudgetStatement,
  BudgetVenue,
  BudgetVote,
  BudgetVotingDay,
} from "@/lib/api/budget";
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
  // Largest remainders: whole numbers that add up to 100 (rounding each could give 101, and a negative «contra»).
  const keys = ["favor", "abstention", "against"] as const;
  const exact = keys.map((key) => (votes[key] / total) * 100);
  const shares = exact.map(Math.floor);
  const order = keys.map((_, index) => index).sort((a, b) => exact[b]! - shares[b]! - (exact[a]! - shares[a]!) || a - b);
  for (let left = 100 - shares.reduce((sum, value) => sum + value, 0), at = 0; left > 0; left--, at++) shares[order[at]!]! += 1;
  return { favor: shares[0]!, abstention: shares[1]!, against: shares[2]! };
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
  // The latest to begin: the plenary in the morning, then the committee in the afternoon.
  const started = schedule
    .filter((item) => !item.allDay && (item.started ?? Date.parse(item.startsAt) <= now) && lisbonDay(item.startsAt) === today)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  if (started) return { state: "session", session: started };
  return { state: "between", next: schedule.find((item) => Date.parse(item.startsAt) > now) ?? null };
}

const VENUE_OF: Record<BudgetSessionStage, BudgetVenue> = {
  committee: "committee",
  plenary: "plenary",
  general_vote: "plenary",
  final_vote: "plenary",
};

/**
 * A session began, and every proposal the voting scripts put on it today is still to vote: the parliament hasn't
 * published its results yet (they come in a while after). Where, or null when some are in or nothing is known.
 */
export function awaitingResults(session: BudgetSession | null, days: BudgetVotingDay[], today: string): BudgetVenue | null {
  if (!session?.stage) return null;
  const venue = VENUE_OF[session.stage];
  const day = days.find((entry) => entry.date === today && entry.venue === venue);
  return day && day.proposals > 0 && day.pending === day.proposals ? venue : null;
}

/** The session that ends with the final overall vote, once the parliament's agenda shows it. */
export const finalVoteSession = (schedule: BudgetSession[]): BudgetSession | null =>
  schedule.find((item) => item.stage === "final_vote") ?? null;

/** «10h00», in Lisbon's time. */
export const sessionTime = (value: string): string | null => formatTime(value)?.replace(":", "h") ?? null;

const OTHER_RESULTS: [BudgetResult, string, string][] = [
  ["withdrawn", "retiradas", "retirada"],
  ["not_admitted", "não admitidas", "não admitida"],
  ["superseded", "prejudicadas", "prejudicada"],
  ["unclear", "por esclarecer", "por esclarecer"],
];
const listPt = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} ou ${items[items.length - 1]}` : (items[0] ?? "");

/**
 * The counts at the top, all from the results so they add up to the total: voted (approved, in part or whole, plus
 * rejected), still to vote (pending and sent to the plenary), and the rest (withdrawn, not admitted…), named.
 */
export function budgetTally(results: Partial<Record<BudgetResult, number>>) {
  const n = (key: BudgetResult) => results[key] ?? 0;
  const approved = n("approved") + n("partially_approved");
  const rejected = n("rejected");
  const pending = n("pending") + n("sent_to_plenary");
  const other = OTHER_RESULTS.reduce((sum, [key]) => sum + n(key), 0);
  const named = OTHER_RESULTS.filter(([key]) => n(key) > 0).map(([, many, one]) => (other === 1 ? one : many));
  return {
    total: approved + rejected + pending + other,
    voted: approved + rejected,
    approved,
    rejected,
    pending,
    other,
    otherLabel: named.length > 0 ? listPt(named) : null,
  };
}

/** Feminine party names, for «da IL»; the rest read «do». */
const FEMININE = new Set(["il"]);

/** «do PCP», «da IL», «do PSD e do CDS-PP», «de Ana Lopes»: who proposed it, inside a sentence. Null when unknown. */
export function authorsPhrase(authors: BudgetProposal["authors"]): string | null {
  const parts = [
    ...authors.parties.map((party) => `${FEMININE.has(party.slug) ? "da" : "do"} ${partyShort(party)}`),
    ...authors.deputies.map((deputy) => `de ${deputy}`),
  ];
  if (parts.length === 0) return null;
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0]!;
}

/** The parliament writes «Rejeitado(a) em Comissão»; a proposal is feminine. */
export const tidyStatus = (status: string | null): string | null => status?.replace(/o\(a\)/g, "a") ?? null;

/** When it was published, as a number to sort by (any UTC offset); undated last. */
const momentOf = (value: string | null) => (value && Date.parse(value)) || 0;

/**
 * «O que disseram», by party: statements without a party are left out (owner's call); the party whose latest
 * statement is newest comes first, and each party's statements newest first.
 */
export function statementGroups(statements: BudgetStatement[]): { party: BudgetParty; statements: BudgetStatement[] }[] {
  const newest = (a: BudgetStatement, b: BudgetStatement) => momentOf(b.publishedAt) - momentOf(a.publishedAt);
  const groups = new Map<string, { party: BudgetParty; statements: BudgetStatement[] }>();
  for (const statement of [...statements].sort(newest)) {
    if (!statement.party) continue;
    const group = groups.get(statement.party.slug) ?? { party: statement.party, statements: [] };
    group.statements.push(statement);
    groups.set(statement.party.slug, group);
  }
  return [...groups.values()];
}

/**
 * The next day the voting scripts plan for a proposal still to be voted (planned, not certain). Once voted, none: the
 * result says it. A day gone by without the vote (postponed) is dropped rather than shown out of date.
 */
export function nextPlanned(proposal: Pick<BudgetProposal, "result" | "scheduled">, today: string | null): BudgetPlanned | null {
  if (proposal.result !== "pending" && proposal.result !== "sent_to_plenary") return null;
  return proposal.scheduled.find((entry) => !today || entry.date >= today) ?? null;
}

const VENUES: Record<BudgetVenue, string> = { committee: "em comissão", plenary: "em plenário" };

/** «Prevista para votação hoje, em comissão» / «… a 24-11-2026, em plenário». */
export function plannedLine(entry: BudgetPlanned, today: string | null): string {
  return `Prevista para votação ${entry.date === today ? "hoje" : `a ${formatDate(entry.date)}`}, ${VENUES[entry.venue]}`;
}

/** The voting days from today on, committee and plenary together, oldest first. */
export function plannedDays(
  days: BudgetVotingDay[],
  today: string | null,
): { date: string; proposals: number; pending: number; venues: BudgetVenue[] }[] {
  const byDate = new Map<string, { date: string; proposals: number; pending: number; venues: BudgetVenue[] }>();
  for (const day of days) {
    if (today && day.date < today) continue;
    const entry = byDate.get(day.date) ?? { date: day.date, proposals: 0, pending: 0, venues: [] };
    entry.proposals += day.proposals;
    entry.pending += day.pending;
    if (!entry.venues.includes(day.venue)) entry.venues.push(day.venue);
    byDate.set(day.date, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

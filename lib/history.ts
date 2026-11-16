import type { GovernmentEndReason, HistoricalGovernment, TimelineEvent } from "./types";

/** The day of the revolution, where the history starts. */
export const REVOLUTION = "1974-04-25";

export const END_LABELS: Record<GovernmentEndReason, string> = {
  end_of_term: "Fim da legislatura",
  early_election: "Eleições antecipadas",
  censure: "Moção de censura aprovada",
  confidence_rejected: "Moção de confiança rejeitada",
  programme_rejected: "Programa do Governo rejeitado",
  resignation: "Demissão do Primeiro-Ministro",
  dismissed: "Exonerado pelo Presidente",
  death: "Morte do Primeiro-Ministro",
  provisional: "Governo provisório",
  in_office: "Em funções",
};

/** Brought down by a vote in Parliament. */
const FELL_IN_PARLIAMENT: readonly GovernmentEndReason[] = ["censure", "confidence_rejected", "programme_rejected"];

/** How a government ended, for the badge: it lasted, Parliament brought it down, it ended early otherwise, or it is still in office. */
export type EndTone = "lasted" | "fell" | "early" | "current" | "provisional" | "unknown";

export function endTone(reason: GovernmentEndReason | null): EndTone {
  if (!reason) return "unknown";
  if (reason === "end_of_term") return "lasted";
  if (reason === "in_office") return "current";
  if (reason === "provisional") return "provisional";
  return FELL_IN_PARLIAMENT.includes(reason) ? "fell" : "early";
}

const parseDay = (day: string) => {
  const [year, month, date] = day.slice(0, 10).split("-").map(Number);
  return { year: year!, month: month!, date: date! };
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "2 anos e 3 meses", "8 meses", "42 dias": the time from one day to another, in whole calendar months. */
export function durationLabel(start: string, end: string): string {
  const from = parseDay(start);
  const to = parseDay(end);
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.date < from.date) months--;
  if (months < 1) {
    const days = Math.round((Date.UTC(to.year, to.month - 1, to.date) - Date.UTC(from.year, from.month - 1, from.date)) / 86_400_000);
    return plural(days, "dia", "dias");
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return plural(rest, "mês", "meses");
  return rest === 0 ? plural(years, "ano", "anos") : `${plural(years, "ano", "anos")} e ${plural(rest, "mês", "meses")}`;
}

/** The same, from a number of days (an average, say), in average-length months. */
export function daysLabel(days: number): string {
  const months = Math.round(days / 30.44);
  if (months < 1) return plural(Math.round(days), "dia", "dias");
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return plural(rest, "mês", "meses");
  return rest === 0 ? plural(years, "ano", "anos") : `${plural(years, "ano", "anos")} e ${plural(rest, "mês", "meses")}`;
}

/** A government's last day, or today while it is in office. */
export const endOf = (government: HistoricalGovernment, today: string) => government.end ?? today;

export function historyStats(governments: readonly HistoricalGovernment[]) {
  const constitutional = governments.filter((item) => item.kind === "constitutional");
  const ended = constitutional.filter((item) => !item.current);
  const byLength = [...constitutional].sort((a, b) => b.days - a.days);
  return {
    total: governments.length,
    provisional: governments.length - constitutional.length,
    constitutional: constitutional.length,
    /** Lasted the whole legislature. */
    lasted: ended.filter((item) => item.endReason === "end_of_term").length,
    /** Brought down by a vote in Parliament. */
    fell: ended.filter((item) => item.endReason !== null && FELL_IN_PARLIAMENT.includes(item.endReason)).length,
    ended: ended.length,
    longest: byLength[0] ?? null,
    shortest: [...ended].sort((a, b) => a.days - b.days)[0] ?? null,
    averageDays: ended.length > 0 ? ended.reduce((sum, item) => sum + item.days, 0) / ended.length : 0,
  };
}

/** "Anos 70" … "Anos 2020". */
export function decadeLabel(day: string): string {
  const decade = Math.floor(parseDay(day).year / 10) * 10;
  return `Anos ${decade < 2000 ? decade % 100 : decade}`;
}

export type TimelineEntry =
  { kind: "government"; date: string; government: HistoricalGovernment } | { kind: "event"; date: string; event: TimelineEvent };

/** Governments and events on one line, newest first, grouped by decade. */
export function timelineByDecade(governments: readonly HistoricalGovernment[], events: readonly TimelineEvent[]) {
  const entries: TimelineEntry[] = [
    ...governments.map((government) => ({ kind: "government" as const, date: government.start, government })),
    ...events.map((event) => ({ kind: "event" as const, date: event.date, event })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "government" ? -1 : 1));
  const decades: { label: string; entries: TimelineEntry[] }[] = [];
  for (const entry of entries) {
    const label = decadeLabel(entry.date);
    const last = decades.at(-1);
    if (last?.label === label) last.entries.push(entry);
    else decades.push({ label, entries: [entry] });
  }
  return decades;
}

const dayNumber = (day: string) => {
  const { year, month, date } = parseDay(day);
  return Date.UTC(year, month - 1, date) / 86_400_000;
};

/** Where a span sits on an axis from `from` to `to`, as percentages of its width. */
export function spanOnAxis(start: string, end: string, from: string, to: string): { left: number; width: number } {
  const length = dayNumber(to) - dayNumber(from);
  if (length <= 0) return { left: 0, width: 0 };
  const left = Math.max(0, (dayNumber(start) - dayNumber(from)) / length);
  const right = Math.min(1, (dayNumber(end) - dayNumber(from)) / length);
  return { left: left * 100, width: Math.max(0, right - left) * 100 };
}

/** The first year of each decade between two days, for the axis ticks. */
export function decadeTicks(from: string, to: string): number[] {
  const first = Math.ceil(parseDay(from).year / 10) * 10;
  const ticks: number[] = [];
  for (let year = first; year <= parseDay(to).year; year += 10) ticks.push(year);
  return ticks;
}

export type HistoryGroup = "ps" | "psd" | "coalition" | "presidential" | "provisional";

/** Who led it: PS or PSD (with partners or not), a President's own initiative, or a provisional government. */
export function groupsOf(government: HistoricalGovernment): HistoryGroup[] {
  if (government.kind === "provisional") return ["provisional"];
  if (government.parties.length === 0) return ["presidential"];
  const groups: HistoryGroup[] = [];
  const leader = government.parties[0]!.slug;
  if (leader === "ps" || leader === "psd") groups.push(leader);
  if (government.parties.length > 1) groups.push("coalition");
  return groups;
}

/** The colour of each way a government ended. */
export const TONE_COLOR: Record<EndTone, string> = {
  lasted: "var(--stage-law)",
  fell: "var(--stage-stopped)",
  early: "var(--stage-debate)",
  current: "var(--ink)",
  provisional: "var(--muted)",
  unknown: "var(--muted)",
};

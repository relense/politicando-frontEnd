import type { PathStep, StepKind } from "./api/people";
import { formatDate } from "./format";

/**
 * The note that must sit next to a person's status in a case (backend docs/cases-api.md, wording rules 1 and 2):
 * nobody is guilty until a conviction is final.
 */
export function statusNote(personStatus: string, final: boolean): string | null {
  if (personStatus === "arguido" || personStatus === "accused" || personStatus === "sent_to_trial") return "Presume-se inocente";
  if (personStatus === "convicted" && !final) return "Decisão não transitada em julgado";
  return null;
}

const year = (day: string | null) => day?.slice(0, 4) ?? null;

/**
 * When a step happened. A legislature-precision step only says they sat at some point in it, so it is shown as
 * the legislature's years ("2024–2025"), never as exact dates.
 */
export function stepWhen(step: Pick<PathStep, "from" | "to" | "precision" | "current">): string | null {
  if (step.precision === "legislature") {
    const from = year(step.from);
    const to = step.current || !step.to ? "atualidade" : year(step.to);
    if (!from) return null;
    return from === to ? from : `${from}–${to}`;
  }
  if (!step.from) return null;
  if (step.to === step.from) return formatDate(step.from);
  if (!step.to) return `desde ${formatDate(step.from)}`;
  return `${formatDate(step.from)} – ${formatDate(step.to)}`;
}

/** "XVI legislatura (2024–2025)": the title of a legislature step, with its years. */
export function stepHeading(step: PathStep): { title: string; detail: string | null; when: string | null } {
  const when = stepWhen(step);
  if (step.precision === "legislature") {
    const detail = step.detail ? `${step.detail}${when ? ` (${when})` : ""}` : when;
    return { title: step.title, detail, when: null };
  }
  return { title: step.title, detail: step.detail, when };
}

export const STEP_LABELS: Record<StepKind, string> = {
  parliament: "Parlamento",
  government: "Governo",
  presidency: "Presidência",
  party: "Partido",
  local: "Poder local",
  election: "Eleição",
  other: "Outro",
};

const euros = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** "1 234 567 €", without cents: contract totals are large and approximate enough. */
export function formatEuros(value: number): string {
  return euros.format(value);
}

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** "Revisto a 15 nov. 2026": the same text on the server and in every browser. */
export function reviewedLabel(day: string | null): string | null {
  const match = day?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `Revisto a ${Number(match[3])} ${month} ${match[1]}` : null;
}

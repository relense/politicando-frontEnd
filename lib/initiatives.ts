import { lisbonDay } from "@/lib/format";
import type { Initiative, InitiativePresidency, PlainStage } from "./types";

export const initiativePath = (id: number) => `/iniciativas/${id}`;

/** The plain title when there is one, else the official one. */
export const headlineOf = (initiative: Pick<Initiative, "title" | "plain">) => initiative.plain?.title || initiative.title;

/** True when the plain title differs enough from the official one to be worth showing both. */
export const hasPlainTitle = (initiative: Pick<Initiative, "title" | "plain">) =>
  !!initiative.plain?.title && initiative.plain.title.trim() !== initiative.title.trim();

/** How a stage ended without approval, or null while it is still on its way (or approved). */
export type StageEnd = "rejected" | "not_admitted" | "withdrawn" | null;

export type StageProgress = {
  /** The steps of its path: laws go through the President, recommendations stop at the vote. */
  steps: string[];
  /** How many steps are done (0 to steps.length). */
  reached: number;
  /** Set when the path ended without approval; `reached` is then where it stopped. */
  ended: StageEnd;
  /** Vetoed by the President: stopped at the President's step. */
  vetoed: boolean;
};

const LAW_STEPS = ["Entregue", "Em debate", "Votada", "Presidente", "Lei"];
const RECOMMENDATION_STEPS = ["Entregue", "Em debate", "Votada"];

/** Steps completed for each stage, on the path of a law. */
const LAW_REACHED: Record<PlainStage, number> = {
  submitted: 1,
  committee: 2,
  consultation: 2,
  debate: 2,
  approved_in_principle: 2,
  approved: 3,
  awaiting_president: 4,
  vetoed: 4,
  promulgated: 5,
  published: 5,
  rejected: 3,
  not_admitted: 1,
  withdrawn: 1,
};

/**
 * Where an initiative stands on its path, for a small progress bar. Rejected ones stop at the vote, withdrawn
 * and inadmissible ones at the start; for recommendations, "published" just means approved.
 */
export function stageProgress(stage: PlainStage, makesLaw: boolean): StageProgress {
  const steps = makesLaw ? LAW_STEPS : RECOMMENDATION_STEPS;
  const ended: StageEnd = stage === "rejected" || stage === "not_admitted" || stage === "withdrawn" ? stage : null;
  return {
    steps,
    reached: Math.min(steps.length, LAW_REACHED[stage]),
    ended,
    vetoed: makesLaw && stage === "vetoed",
  };
}

/**
 * The colour family of a stage, as on the path of a law: entered, under discussion, approved, with the President,
 * law, and the ends (vetoed or rejected, withdrawn). Each has a CSS colour `--stage-<tone>`.
 */
export type StageTone = "submitted" | "debate" | "approved" | "president" | "law" | "stopped" | "withdrawn";

export function stageTone(stage: PlainStage | null | undefined, makesLaw = true): StageTone {
  switch (stage) {
    case "submitted":
      return "submitted";
    case "committee":
    case "consultation":
    case "debate":
    case "approved_in_principle":
      return "debate";
    case "approved":
      return "approved";
    case "awaiting_president":
      return "president";
    case "promulgated":
    case "published":
      return makesLaw ? "law" : "approved";
    case "vetoed":
    case "rejected":
      return "stopped";
    case "not_admitted":
    case "withdrawn":
      return "withdrawn";
    default:
      return "debate";
  }
}

/** `var(--stage-debate)` and the like, for inline styles. */
export const toneColor = (tone: StageTone) => `var(--stage-${tone})`;

/** The API's phases (`stage` on /initiatives), in the order a law goes through them; `end` for where it stops. */
export const INITIATIVE_STAGES = [
  { key: "submitted", label: "Entregue", tone: "submitted", end: false },
  { key: "debate", label: "Em debate", tone: "debate", end: false },
  { key: "approved", label: "Aprovada", tone: "approved", end: false },
  { key: "president", label: "No Presidente", tone: "president", end: false },
  { key: "published", label: "Lei", tone: "law", end: false },
  { key: "vetoed", label: "Vetada", tone: "stopped", end: true },
  { key: "rejected", label: "Rejeitada", tone: "stopped", end: true },
  { key: "withdrawn", label: "Retirada", tone: "withdrawn", end: true },
] as const satisfies readonly { key: string; label: string; tone: StageTone; end: boolean }[];

export type InitiativeStageKey = (typeof INITIATIVE_STAGES)[number]["key"];

export const PRESIDENCY_LABELS: Record<InitiativePresidency["status"], string> = {
  pending: "À espera do Presidente",
  promulgated: "Promulgada",
  vetoed: "Vetada",
};

/** "Vetada e depois promulgada" when Parliament passed it again after a veto. */
export function presidencyLabel(presidency: InitiativePresidency): string {
  if (presidency.status === "promulgated" && presidency.vetoedAt) return "Vetada e depois promulgada";
  if (presidency.status === "vetoed" && presidency.vetoKind === "unconstitutionality") return "Vetada por inconstitucionalidade";
  return PRESIDENCY_LABELS[presidency.status];
}

/**
 * The date for «Atualizada a»: the latest stage's, unless it's still to come. The Parliament dates some stages ahead
 * (the OE's specialty debate carried the day it ends), and a future date can't be when it was updated.
 */
// `now` defaults to the clock: it only decides whether a day has come, so a re-render can't change the answer except
// across midnight, and server and browser agree.
export function updatedOn(phaseDate: string | null | undefined, now: number = Date.now()): string | null {
  if (!phaseDate) return null;
  const today = lisbonDay(new Date(now).toISOString());
  return today !== null && phaseDate.slice(0, 10) <= today ? phaseDate : null;
}

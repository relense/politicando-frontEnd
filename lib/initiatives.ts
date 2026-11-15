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

const LAW_STEPS = ["Entregue", "Em comissão", "Em debate", "Aprovada", "Presidente", "Publicada"];
const RECOMMENDATION_STEPS = ["Entregue", "Em comissão", "Em debate", "Aprovada"];

/** Steps completed for each stage, on the path of a law. */
const LAW_REACHED: Record<PlainStage, number> = {
  submitted: 1,
  committee: 2,
  consultation: 2,
  debate: 3,
  approved_in_principle: 3,
  approved: 4,
  awaiting_president: 4,
  vetoed: 4,
  promulgated: 5,
  published: 6,
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

export const PRESIDENCY_LABELS: Record<InitiativePresidency["status"], string> = {
  pending: "À espera do Presidente",
  promulgated: "Promulgada",
  vetoed: "Vetada",
};

/** "Vetada e depois promulgada" when Parliament passed it again after a veto. */
export function presidencyLabel(presidency: InitiativePresidency): string {
  if (presidency.status === "promulgated" && presidency.vetoedAt) return "Vetada e depois promulgada";
  return PRESIDENCY_LABELS[presidency.status];
}

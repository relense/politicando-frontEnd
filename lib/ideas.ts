import type { IdeaStatus, IdeaStep, ThreadSort, ThreadSummary } from "@/lib/api/forums";

/* The ideas board (/feedback): its tabs and filters, an idea's timeline and the «a discutir agora» label. */

export type TimelineStep = {
  label: string;
  /** When the idea first got there (ISO), the expected day ("YYYY-MM-DD") for «Feita», or null. */
  date: string | null;
  /** done: passed; current: where it is; expected: «Feita», with the team's expected date; todo: not yet. */
  state: "done" | "current" | "expected" | "todo";
};

/** The steps a reader sees, and which statuses each one stands for («A fazer»: planned or being done). */
const STEPS: { label: string; statuses: (IdeaStatus | null)[] }[] = [
  { label: "Proposta", statuses: [null] },
  { label: "Em análise", statuses: ["reviewing"] },
  { label: "A fazer", statuses: ["planned", "in_progress"] },
  { label: "Feita", statuses: ["done"] },
];

/**
 * Proposta → Em análise → A fazer → Feita, each dated when the idea first got there. A declined idea ends at «Não vamos
 * fazer» after the steps it passed; a duplicate has no timeline (its page points to the original).
 */
export function ideaTimeline({
  status,
  expectedOn,
  statusHistory,
}: {
  status: IdeaStatus | null;
  expectedOn: string | null;
  statusHistory: IdeaStep[];
}): TimelineStep[] {
  if (status === "duplicate") return [];
  const firstAt = (statuses: (IdeaStatus | null)[]) => statusHistory.find((step) => statuses.includes(step.status))?.at ?? null;
  if (status === "declined") {
    // The steps it went through before, then the decision.
    const passed = STEPS.slice(0, 3).filter((step, index) => index === 0 || firstAt(step.statuses) !== null);
    return [
      ...passed.map((step) => ({ label: step.label, date: firstAt(step.statuses), state: "done" as const })),
      { label: "Não vamos fazer", date: firstAt(["declined"]), state: "current" },
    ];
  }
  const current = Math.max(
    0,
    STEPS.findIndex((step) => step.statuses.includes(status)),
  );
  return STEPS.map((step, index) => {
    if (index < current) return { label: step.label, date: firstAt(step.statuses), state: "done" };
    if (index === current) return { label: step.label, date: firstAt(step.statuses), state: "current" };
    if (step.label === "Feita" && expectedOn) return { label: step.label, date: expectedOn, state: "expected" };
    return { label: step.label, date: null, state: "todo" };
  });
}

const HOUR = 3_600_000;

/** «a discutir agora»: someone replied in the last hour. */
export const discussingNow = (idea: Pick<ThreadSummary, "replyCount" | "bumpedAt">, now: number): boolean =>
  idea.replyCount > 0 && now - Date.parse(idea.bumpedAt) < HOUR;

export const IDEA_SORTS: { value: ThreadSort; param: string; label: string }[] = [
  { value: "top", param: "votadas", label: "Mais votadas" },
  { value: "new", param: "novas", label: "Novas" },
  { value: "active", param: "a-discutir", label: "A discutir" },
];

/** The status filters (a duplicate isn't one: it lives on the original). */
export const IDEA_FILTERS: { value: IdeaStatus; param: string; label: string }[] = [
  { value: "reviewing", param: "em-analise", label: "Em análise" },
  { value: "planned", param: "planeadas", label: "Planeadas" },
  { value: "in_progress", param: "a-fazer", label: "A fazer" },
  { value: "done", param: "feitas", label: "Feitas" },
  { value: "declined", param: "nao-vamos-fazer", label: "Não vamos fazer" },
];

export type BoardQuery = { sort: ThreadSort; status: IdeaStatus | null; page: number };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The board's tab, filter and page from the address; anything unknown reads as the default. */
export function boardQuery(params: Record<string, string | string[] | undefined>): BoardQuery {
  const page = one(params.pagina);
  return {
    sort: IDEA_SORTS.find((sort) => sort.param === one(params.ordem))?.value ?? "top",
    status: IDEA_FILTERS.find((filter) => filter.param === one(params.estado))?.value ?? null,
    page: page && /^[1-9]\d{0,3}$/.test(page) ? Number(page) : 1,
  };
}

export function boardPath({ sort, status, page = 1 }: { sort: ThreadSort; status: IdeaStatus | null; page?: number }): string {
  const query = new URLSearchParams();
  if (sort !== "top") query.set("ordem", IDEA_SORTS.find((item) => item.value === sort)!.param);
  if (status) {
    const filter = IDEA_FILTERS.find((item) => item.value === status);
    if (filter) query.set("estado", filter.param);
  }
  if (page > 1) query.set("pagina", String(page));
  return query.size > 0 ? `/feedback?${query}` : "/feedback";
}

export const commentsLabel = (count: number) => (count === 1 ? "1 comentário" : `${count} comentários`);

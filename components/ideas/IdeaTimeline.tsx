import { formatDate } from "@/lib/format";
import type { TimelineStep } from "@/lib/ideas";

/** «14-11» from an ISO date or a day. */
const short = (value: string) => formatDate(value)?.slice(0, 5) ?? "";

/** Proposta → Em análise → A fazer → Feita: a bar per step, filled up to where the idea is, each with its day. */
export function IdeaTimeline({ steps }: { steps: TimelineStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol aria-label="Estado da ideia" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step) => {
        const reached = step.state === "done" || step.state === "current";
        const declined = step.label === "Não vamos fazer";
        return (
          <li key={step.label} aria-current={step.state === "current" ? "step" : undefined} className="min-w-0">
            <span
              aria-hidden="true"
              className="block h-1 rounded-full"
              style={{ backgroundColor: reached ? (declined ? "var(--danger)" : "#f0c75e") : "var(--line)" }}
            />
            <span className={`mt-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider ${reached ? "" : "text-muted"}`}>
              {step.label}
            </span>
            <span className="block font-mono text-[11px] text-muted">
              {step.date ? (step.state === "expected" ? `previsto ${short(step.date)}` : short(step.date)) : " "}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

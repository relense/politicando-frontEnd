import { stageProgress } from "@/lib/initiatives";
import type { PlainStage } from "@/lib/types";

const END_LABELS = { rejected: "Rejeitada", not_admitted: "Não admitida", withdrawn: "Retirada" } as const;

/**
 * Where an initiative stands on its path, as a row of segments. Finished steps are filled; a path that ended
 * without approval, or a veto, is marked where it stopped. The text says the same for screen readers.
 */
export function StageProgress({ stage, makesLaw, labels = false }: { stage: PlainStage; makesLaw: boolean; labels?: boolean }) {
  const { steps, reached, ended, vetoed } = stageProgress(stage, makesLaw);
  const stopped = ended !== null || vetoed;
  const summary = ended
    ? `${END_LABELS[ended]} na fase "${steps[Math.max(0, reached - 1)]}"`
    : vetoed
      ? "Vetada pelo Presidente"
      : reached >= steps.length
        ? `Concluída: ${steps.at(-1)}`
        : `Passo ${reached} de ${steps.length}: ${steps[reached - 1] ?? steps[0]}`;

  return (
    <div>
      <p className="sr-only">{summary}</p>
      <ol aria-hidden="true" className="flex gap-1">
        {steps.map((step, index) => {
          const done = index < reached;
          const last = index === reached - 1;
          const tone = !done
            ? "bg-line"
            : stopped && last
              ? "bg-[repeating-linear-gradient(135deg,var(--color-ink)_0_3px,transparent_3px_6px)] ring-1 ring-ink"
              : "bg-ink";
          return (
            <li key={step} className="min-w-0 flex-1">
              <span className={`block h-1.5 rounded-full ${tone}`} />
              {labels && (
                <span className={`mt-1.5 block truncate font-mono text-[11px] ${done ? "font-bold text-ink" : "text-muted"}`}>
                  {stopped && last ? (ended ? END_LABELS[ended] : "Vetada") : step}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

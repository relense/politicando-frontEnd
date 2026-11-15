import { stageProgress, stageTone, toneColor } from "@/lib/initiatives";
import type { PlainStage } from "@/lib/types";

const END_LABELS = { rejected: "Rejeitada", not_admitted: "Não admitida", withdrawn: "Retirada" } as const;

/**
 * Where an initiative stands on its path, as a row of segments in the colour of its stage: the steps behind are
 * filled softly, the current one fully and named. A path that ended without approval, or a veto, is hatched where
 * it stopped. The text says the same for screen readers.
 */
export function StageProgress({ stage, makesLaw, labels = true }: { stage: PlainStage; makesLaw: boolean; labels?: boolean }) {
  const { steps, reached, ended, vetoed } = stageProgress(stage, makesLaw);
  const stopped = ended !== null || vetoed;
  const color = toneColor(stageTone(stage, makesLaw));
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
          const current = index === reached - 1;
          const background = !done
            ? undefined
            : stopped && current
              ? `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`
              : current
                ? color
                : `color-mix(in srgb, ${color} 45%, transparent)`;
          return (
            <li key={step} className="min-w-0 flex-1">
              <span className={`block h-1 rounded-full ${done ? "" : "bg-line"}`} style={background ? { background } : undefined} />
              {labels && (
                <span
                  className={`mt-1.5 block truncate font-mono text-[11px] ${current ? "font-bold" : "text-muted"}`}
                  style={current ? { color } : undefined}
                >
                  {stopped && current ? (ended ? END_LABELS[ended] : "Vetada") : step}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { hasPlainTitle, headlineOf, initiativePath, presidencyLabel } from "@/lib/initiatives";
import { STATUS_LABELS } from "@/lib/parliament";
import type { Initiative, InitiativePresidency, PlainStage } from "@/lib/types";
import { StageProgress } from "./StageProgress";

/** True when the plain status already says what the President did, so it isn't repeated. */
function statusSaysIt(presidency: InitiativePresidency, stage: PlainStage | null | undefined): boolean {
  if (presidency.status === "pending") return stage === "awaiting_president";
  if (presidency.status === "vetoed") return stage === "vetoed";
  return !presidency.vetoedAt && (stage === "promulgated" || stage === "published");
}

/** Who proposed it, in one line: "Governo", or the parties and deputies who signed it. */
export function proposedBy(initiative: Initiative): string {
  const { authors } = initiative;
  if (authors.other) return authors.other;
  if (authors.parties.length > 0) return authors.parties.map((party) => party.acronym).join(", ");
  return authors.deputies.map((deputy) => deputy.name).join(", ");
}

/**
 * One initiative in a list, in plain language: what it is, where it stands, the plain title linking to its page,
 * and the official title underneath when it differs.
 */
export function InitiativeItem({ initiative, heading = "h3" }: { initiative: Initiative; heading?: "h2" | "h3" | "h4" }) {
  const Heading = heading;
  const { plain, presidency } = initiative;
  const by = proposedBy(initiative);
  const related = initiative.coverage.articles;

  return (
    <article className="border-b border-line py-5">
      <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        <span className="font-bold text-ink">{plain?.type.label ?? initiative.type}</span>
        {plain && !plain.type.makesLaw && (
          <span className="rounded border border-line px-1.5 py-px text-[11px]" title={plain.type.explainer}>
            não muda nenhuma lei
          </span>
        )}
        <span aria-hidden="true">·</span>
        <span>{plain?.status.label ?? STATUS_LABELS[initiative.status]}</span>
        {presidency && !statusSaysIt(presidency, plain?.status.stage) && (
          <>
            <span aria-hidden="true">·</span>
            <span>{presidencyLabel(presidency)}</span>
          </>
        )}
      </p>

      <Heading className="text-lg font-bold leading-snug">
        <Link href={initiativePath(initiative.id)} className="hover:underline">
          {headlineOf(initiative)}
        </Link>
      </Heading>
      {hasPlainTitle(initiative) && <p className="mt-1 line-clamp-2 text-sm text-muted">{initiative.title}</p>}

      {plain?.status.stage && (
        <div className="mt-3 max-w-sm">
          <StageProgress stage={plain.status.stage} makesLaw={plain.type.makesLaw} />
        </div>
      )}

      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted">
        <span>
          {initiative.type}
          {initiative.number && ` n.º ${initiative.number}`}
        </span>
        {by && <span>Proposta por {by}</span>}
        {initiative.phaseDate && <span>Atualizada a {formatDate(initiative.phaseDate)}</span>}
        {related > 0 && <span>{related === 1 ? "1 notícia relacionada" : `${related} notícias relacionadas`}</span>}
      </p>

      {initiative.topics.length > 0 && (
        <ul aria-label="Temas" className="mt-2 flex flex-wrap gap-1.5">
          {initiative.topics.map((topic) => (
            <li key={topic.slug}>
              <Link
                href={`/iniciativas?tema=${topic.slug}`}
                className="rounded-full bg-surface px-2.5 py-0.5 font-mono text-[11px] text-muted hover:text-ink"
              >
                {topic.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { hasPlainTitle, headlineOf, initiativePath, presidencyLabel, stageTone, toneColor, stageDate } from "@/lib/initiatives";
import { partyColor, STATUS_LABELS } from "@/lib/parliament";
import type { Initiative, InitiativePresidency, PlainStage } from "@/lib/types";
import type { Prediction } from "@/lib/api/engagement";
import { NewsLine, POLL_LINE, POLL_TEXT, PollStrip } from "./InitiativeExtras";
import { StageProgress } from "./StageProgress";

/** On the card, the official title only when it says more than the headline: not its first words repeated. */
function officialWorthShowing(initiative: Initiative): boolean {
  if (!hasPlainTitle(initiative)) return false;
  const plain = initiative
    .plain!.title!.trim()
    .toLowerCase()
    .replace(/[.…]+$/, "");
  return !initiative.title.trim().toLowerCase().startsWith(plain);
}

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

/** The authors as chips: "Governo", or each party with its deputy when only one signed for it. */
function authorChips(initiative: Initiative): { key: string; label: string; color: string }[] {
  const { authors } = initiative;
  if (authors.other) return [{ key: "other", label: authors.other, color: "var(--ink)" }];
  return authors.parties.map((party) => {
    const signed = authors.deputies.filter((deputy) => deputy.partySlug === party.slug);
    return {
      key: party.slug,
      label: signed.length === 1 ? `${party.acronym} · ${signed[0]!.name}` : party.acronym,
      color: partyColor(party.slug),
    };
  });
}

const chip = "inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px]";

/**
 * One initiative in a list, in plain language: where it stands (in the colour of its stage), what kind it is, the
 * plain title linking to its page, the official title beside an "Oficial" tag, its path, who proposed it and its
 * topics.
 */
export function InitiativeItem({
  initiative,
  heading = "h3",
  poll = null,
}: {
  initiative: Initiative;
  heading?: "h2" | "h3" | "h4";
  /** Its open "Passa ou chumba?", when it has one: a strip to predict, a tag, and a line on the left. */
  poll?: Prediction | null;
}) {
  const Heading = heading;
  const { plain, presidency } = initiative;
  const color = toneColor(stageTone(plain?.status.stage, plain?.type.makesLaw ?? true));
  const parties = initiative.authors.other ? [] : initiative.authors.parties.map((party) => party.acronym);
  // A stage dated ahead is the day the Parliament scheduled it, not when it was updated (lib/initiatives stageDate).
  const stage = stageDate(initiative.phaseDate);
  const stageDay = formatDate(stage?.date);

  return (
    <article
      className={`border-b border-line py-6 ${poll ? "-ml-3 border-l-2 pl-3 sm:-ml-4 sm:pl-4" : ""}`}
      style={poll ? { borderLeftColor: POLL_LINE } : undefined}
    >
      <p className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-xs text-muted">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: color }} />
          {plain?.status.label ?? STATUS_LABELS[initiative.status]}
        </span>
        <span>
          {plain?.type.label ?? initiative.type}
          {parties.length > 0 && ` · ${parties.join(", ")}`}
          {initiative.number && ` · n.º ${initiative.number}`}
        </span>
        {plain && !plain.type.makesLaw && (
          <span className="rounded border border-line px-1.5 py-px text-[11px]" title={plain.type.explainer}>
            não muda nenhuma lei
          </span>
        )}
        {presidency && !statusSaysIt(presidency, plain?.status.stage) && <span>· {presidencyLabel(presidency)}</span>}
        {poll && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${POLL_TEXT}`}
            style={{ background: `color-mix(in srgb, ${POLL_LINE} 14%, transparent)` }}
          >
            Previsão aberta
          </span>
        )}
      </p>

      <Heading className="text-xl font-bold leading-snug sm:text-2xl">
        <Link href={initiativePath(initiative.id)} className="hover:underline">
          {headlineOf(initiative)}
        </Link>
      </Heading>
      {officialWorthShowing(initiative) && (
        <p className="mt-2 flex gap-3 text-sm leading-relaxed text-muted">
          <span className="mt-0.5 h-fit shrink-0 rounded border border-line px-1.5 py-px font-mono text-[10px] font-bold tracking-widest">
            OFICIAL
          </span>
          <span className="line-clamp-3">{initiative.title}</span>
        </p>
      )}

      {plain?.status.stage && (
        <div className="mt-4 max-w-md">
          <StageProgress stage={plain.status.stage} makesLaw={plain.type.makesLaw} />
        </div>
      )}

      {poll && <PollStrip initiativeId={initiative.id} poll={poll} />}
      <NewsLine initiative={initiative} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <ul aria-label="Autores e temas" className="flex flex-wrap gap-1.5">
          {authorChips(initiative).map((author) => (
            <li key={author.key} className={chip}>
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: author.color }} />
              {author.label}
            </li>
          ))}
          {initiative.topics.map((topic) => (
            <li key={topic.slug}>
              <Link href={`/iniciativas?tema=${topic.slug}`} className={`${chip} hover:bg-surface`}>
                <span aria-hidden="true" className="text-muted">
                  #
                </span>
                {topic.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[11px] text-muted">
          {stageDay && <>{stage?.scheduled ? `Marcada para ${stageDay}` : `Atualizada a ${stageDay}`}</>}
        </p>
      </div>
    </article>
  );
}

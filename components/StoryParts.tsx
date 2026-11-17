import Link from "next/link";
import type { DebateComment, StoryDetail } from "@/lib/api/stories";
import { editorialPath, KIND_LABELS } from "@/lib/editorial";
import { formatCardWhen, formatDateTime, formatLongDate, formatNumber } from "@/lib/format";
import { partyPath } from "@/lib/parties";
import type { EditorialKind } from "@/lib/types";
import { ImportaButton, ImportanceDots } from "./ImportaButton";
import { SourceLogo } from "./SourceLogo";

/** The parts of an article page when the article is one outlet's version of a story. */

/** "7 jornais nesta história", when it started and last moved, and the outlets as tabs to switch versions. */
export function StoryVersions({ story, current }: { story: StoryDetail; current: number }) {
  if (story.sourceCount < 2) return null;
  return (
    <nav aria-label="Versões desta notícia" className="mb-5">
      <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        <b className="rounded bg-[var(--marker)] px-1.5 py-0.5 text-ink">{story.sourceCount} jornais nesta história</b>
        <span>
          {/* Plain text, not <time>: the article's own date, below, is the page's. */}
          Primeira notícia: {formatDateTime(story.firstPublishedAt)}
        </span>
        <span aria-hidden="true">·</span>
        <span>última {formatCardWhen(story.lastPublishedAt)}</span>
      </p>
      <p id="ver-versao" className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-muted">
        Ver a versão de
      </p>
      <ul aria-labelledby="ver-versao" className="flex flex-wrap gap-1.5">
        {story.versions.map((item, index) => {
          const here = item.articleId === current;
          return (
            <li key={item.articleId}>
              <Link
                href={`/article/${item.articleId}`}
                aria-current={here ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg border py-1 pl-1 pr-2.5 font-mono text-xs font-bold ${
                  here ? "border-ink bg-surface" : "border-line hover:bg-surface"
                }`}
              >
                <SourceLogo domain={item.sourceDomain} name={item.source} size={20} />
                {item.source}
                {index === 0 && <span className="font-normal text-muted">1.º</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Every outlet's headline, first published first: often the difference is in one word. */
export function HowEachToldList({ story, current }: { story: StoryDetail; current: number }) {
  if (story.sourceCount < 2) return null;
  return (
    <section aria-labelledby="como-cada-jornal" className="mt-10">
      <h2 id="como-cada-jornal" className="border-b-2 border-ink pb-2 font-mono text-xs font-bold uppercase tracking-widest">
        Como cada jornal contou
      </h2>
      <p className="mt-2 text-sm text-muted">Por ordem de publicação. Compara os títulos: às vezes a diferença está numa palavra.</p>
      <ol className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {story.versions.map((item, index) => {
          const here = item.articleId === current;
          return (
            <li key={item.articleId} className={`flex items-start gap-3 px-3 py-3 ${here ? "bg-surface" : ""}`}>
              <SourceLogo domain={item.sourceDomain} name={item.source} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[11px] text-muted">
                  <b className="text-ink">{item.source}</b> · {formatDateTime(item.publishedAt)}
                  {index === 0 && " · primeiro a publicar"}
                  {here && " · a ver"}
                </span>
                {here ? (
                  <span className="block leading-snug">{item.title}</span>
                ) : (
                  <Link href={`/article/${item.articleId}`} className="block leading-snug hover:underline">
                    {item.title}
                  </Link>
                )}
              </span>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ler em ${item.source} (abre num novo separador)`}
                  className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-xs font-bold hover:bg-surface"
                >
                  Ler <span aria-hidden="true">↗</span>
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The most liked comment on each side, side by side; only when both exist (one side alone isn't a debate). */
export function DebatePair({
  debate,
  compact = false,
  className = "mb-6",
}: {
  debate: { agree: DebateComment; disagree: DebateComment };
  /** On a feed card: no names, two lines each. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      <Side comment={debate.agree} label="A favor" color="var(--favor)" compact={compact} />
      <Side comment={debate.disagree} label="Contra" color="var(--contra)" compact={compact} />
    </div>
  );
}

function Side({ comment, label, color, compact }: { comment: DebateComment; label: string; color: string; compact: boolean }) {
  return (
    <figure className="rounded-xl border border-[var(--card-line-soft)] bg-[var(--inset)] px-3.5 py-3">
      <figcaption
        className="mb-1.5 flex items-center justify-between font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color }}
      >
        {label}
        <span>
          <span aria-hidden="true">▲ </span>
          <span className="sr-only">Gostos: </span>
          {formatNumber(comment.likes)}
        </span>
      </figcaption>
      <blockquote className={`text-[15.5px] leading-[1.4] text-[var(--text-quote)] ${compact ? "line-clamp-2" : ""}`}>
        “{comment.text}”
      </blockquote>
      {!compact && <p className="mt-2 font-mono text-[11px] text-muted">{comment.username ?? "Anónimo"}</p>}
    </figure>
  );
}

/** Beside the story: how many readers say it matters, and the button to say so. */
export function ImportaBox({ story }: { story: StoryDetail }) {
  return (
    <section aria-labelledby="importa" className="flex items-center gap-3 rounded-2xl border border-line p-4">
      <ImportanceDots importance={story.importance} className="w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="importa" className="text-2xl font-bold leading-none">
          {formatNumber(story.importa)}
        </h2>
        <p className="font-mono text-[11px] text-muted">{story.importa === 1 ? "leitor diz que importa" : "leitores dizem que importa"}</p>
      </div>
      <ImportaButton id={story.id} title={story.title} importa={story.importa} importance={story.importance} />
    </section>
  );
}

/**
 * "Contexto": our own pages about the story's subject. Explica (our blog posts that explain it), Partido (how its main
 * party votes) and Agenda (what's coming). Hidden when there's none of the three.
 */
export function StoryContextBox({ story }: { story: StoryDetail }) {
  const { explainers, agenda } = story.context;
  const party = story.parties[0];
  if (explainers.length === 0 && agenda.length === 0 && !party) return null;
  const subject = story.tags[0];
  const badge = (label: string, color: string) => (
    <span
      className="w-fit rounded-[5px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
    >
      {label}
    </span>
  );
  const item = "flex flex-col gap-1 py-2.5";
  return (
    <section aria-labelledby="contexto-historia" className="rounded-2xl border border-[var(--card-line)] bg-[var(--card)] p-4">
      <h2 id="contexto-historia" className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        Contexto{subject && <span className="text-[var(--accent)]"> · #{subject.label}</span>}
      </h2>
      <ul className="mt-1 divide-y divide-[var(--card-line-soft)]">
        {explainers.map((post) => (
          <li key={post.slug} className={item}>
            {badge("Explica", "var(--kind-explica)")}
            <Link href={editorialPath(post.slug)} className="font-semibold leading-snug hover:underline">
              {post.title}
            </Link>
            <span className="font-mono text-[11px] text-muted">Blog · {KIND_LABELS[post.kind as EditorialKind] ?? "Artigo"} →</span>
          </li>
        ))}
        {party && (
          <li className={item}>
            {badge("Partido", "var(--kind-partido)")}
            <Link href={`${partyPath(party.slug)}#como-vota`} className="font-semibold leading-snug hover:underline">
              Como votou o {party.acronym} nesta legislatura
            </Link>
            <span className="font-mono text-[11px] text-muted">Página do partido →</span>
          </li>
        )}
        {agenda.map((event) => (
          <li key={event.id} className={item}>
            {badge("Agenda", "var(--kind-agenda)")}
            <Link href={`/agenda#evento-${event.id}`} className="font-semibold leading-snug hover:underline">
              {event.title}
            </Link>
            <span className="font-mono text-[11px] text-muted">
              Agenda · {event.allDay ? formatLongDate(event.startsAt) : formatDateTime(event.startsAt)} →
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

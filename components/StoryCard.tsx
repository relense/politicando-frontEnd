import Link from "next/link";
import { ArticleKindLabel } from "@/components/ArticleKind";
import { leadOf, storyPath, storyPhoto, type Story } from "@/lib/api/stories";
import { excerpt, formatCardWhen, formatDateTime, formatNumber } from "@/lib/format";
import { initiativePath } from "@/lib/initiatives";
import { partyPath } from "@/lib/parties";
import { ArticleImage } from "./ArticleImage";
import { ArticleMenu } from "./ArticleMenu";
import { CardShare } from "./CardShare";
import { CommentIcon } from "./icons";
import { ImportaButton } from "./ImportaButton";
import { PartyChips } from "./PartyChips";
import { SaveButton } from "./SaveButton";
import { cardAction, cardActions, cardBox, cardExcerpt, cardImage, cardMeta, cardReadOn, cardTitle, cardTitleLink } from "./feedCard";
import { SourceLogo } from "./SourceLogo";
import { DebatePair } from "./StoryParts";
import { outletClick } from "@/lib/analytics";

export { leadOf };

/** A story's kind to show: «Opinião», «Podcast» or «Newsletter»; news, the usual, says nothing. */
export const storyKind = (story: Pick<Story, "kind">) => (story.kind === "news" ? null : story.kind);

/**
 * A story in the feed: one card for the same news told by several outlets. The first outlet and "+6 jornais"; the
 * headline most outlets used; the photo; the outlets' logos with how each one headlined it; links to our own pages
 * about it; then Importa, comments and share.
 */
export function StoryCard({ story, why }: { story: Story; why?: string }) {
  const path = storyPath(story);
  const lead = leadOf(story);
  // The lead outlet's photo, or another outlet's credited to it: an empty frame only when no outlet has one.
  const photo = storyPhoto(story);
  const others = story.sourceCount - 1;
  const text = story.excerpt ? excerpt(story.excerpt) : "";

  return (
    <article className={cardBox}>
      <div className="flex items-center justify-between gap-2.5">
        <p className={cardMeta}>
          <span className="inline-flex items-center gap-2.5 font-semibold text-ink">
            <SourceLogo domain={lead.sourceDomain} name={lead.source} size={30} square />
            {lead.source}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={story.lastPublishedAt} title={formatDateTime(story.lastPublishedAt) ?? undefined}>
            {formatCardWhen(story.lastPublishedAt)}
          </time>
          {others > 0 && (
            <span className="contents max-sm:hidden">
              <span aria-hidden="true">·</span>
              <span className="text-ink">
                +{others} {others === 1 ? "jornal" : "jornais"}
              </span>
            </span>
          )}
        </p>
        {why !== undefined && (
          <ArticleMenu
            article={{
              id: lead.articleId,
              title: story.title,
              source: lead.source,
              sourceDomain: lead.sourceDomain,
              parties: story.parties,
            }}
            why={why}
          />
        )}
      </div>
      <ArticleKindLabel kind={storyKind(story)} className="mt-1" />

      <h2 className={cardTitle}>
        {/* The whole card opens the story; the links on it stay on top. */}
        <Link href={path} className={cardTitleLink}>
          {story.title}
        </Link>
      </h2>

      {/* On a phone the title, the photo and the outlets say enough: no excerpt. */}
      {text && <p className={`${cardExcerpt} max-sm:hidden`}>{text}</p>}

      <ArticleImage
        src={photo?.url ?? null}
        alt={story.title}
        href={path}
        caption={photo?.credit ? `Imagem · ${photo.credit}` : "Imagem de outro jornal"}
        source={lead.source}
        sourceDomain={lead.sourceDomain}
        className={cardImage}
        imageClassName="size-full object-cover"
      />

      {story.sourceCount > 1 && <HowEachTold story={story} />}

      <StoryContext story={story} className="relative z-10 mt-3" />

      {story.parties.length > 0 && <PartyChips parties={story.parties} className="relative z-10 mt-2.5" />}

      {story.debate && <DebatePair debate={story.debate} compact className="relative z-10 mt-3" />}

      <div className={cardActions}>
        <ImportaButton
          id={story.id}
          title={story.title}
          importa={story.importa}
          importance={story.importance}
          mergedFrom={story.mergedFrom}
        />
        <Link href={`${path}#comentarios`} className={cardAction}>
          <CommentIcon />
          <span>
            <span className="tabular-nums">{formatNumber(story.commentCount)}</span>{" "}
            <span className="max-sm:sr-only">{story.commentCount === 1 ? "comentário" : "comentários"}</span>
          </span>
        </Link>
        <CardShare path={path} title={story.title} className={cardAction} compact />
        <SaveButton articleId={lead.articleId} title={story.title} className={`${cardAction} max-sm:ml-auto`} />
        {lead.url && (
          <a href={lead.url} target="_blank" rel="noopener noreferrer" {...outletClick(lead.url, "card")} className={cardReadOn}>
            Ler {story.sourceCount > 1 ? "no" : "em"} {lead.source}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (abre num novo separador)</span>
          </a>
        )}
      </div>
    </article>
  );
}

/** The outlets' logos and "7 jornais contaram isto"; opened, how each one headlined it. */
function HowEachTold({ story }: { story: Story }) {
  return (
    <details className="group/how relative z-10 mt-3 rounded-xl border border-[var(--card-line-soft)] bg-[var(--inset)] px-3 py-2.5">
      <summary className="flex cursor-pointer list-none items-center gap-3 font-mono text-[12.5px] [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="flex pl-1.5">
          {story.versions.slice(0, 5).map((item) => (
            <span key={item.articleId} className="-ml-1.5 rounded-md ring-2 ring-[var(--inset)]">
              <SourceLogo domain={item.sourceDomain} name={item.source} size={26} square />
            </span>
          ))}
        </span>
        <span>
          <b>{story.sourceCount} jornais</b> contaram isto
        </span>
        <span className="ml-auto whitespace-nowrap text-[11.5px] text-muted">
          <span className="max-sm:hidden">Ver como cada um contou </span>
          <span className="sm:hidden">Comparar </span>
          <span aria-hidden="true" className="inline-block group-open/how:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <ol className="mt-2">
        {story.versions.map((item, index) => (
          // The same row as the article page's «Como cada jornal contou» (components/StoryParts.tsx).
          <li key={item.articleId} className="flex items-start gap-3 border-t border-[var(--card-line-soft)] py-3">
            <SourceLogo domain={item.sourceDomain} name={item.source} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[11px] text-muted">
                <b className="text-ink">{item.source}</b> · <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
                {index === 0 && " · primeiro a publicar"}
              </span>
              <Link href={`/article/${item.articleId}`} className="block leading-snug hover:underline">
                {item.title}
              </Link>
            </span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                {...outletClick(item.url, "how-each-told-card")}
                aria-label={`Ler em ${item.source} (abre num novo separador)`}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-xs font-bold hover:bg-surface"
              >
                Ler <span aria-hidden="true">↗</span>
              </a>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * Up to two chips to our own pages about the story, on one line: how each party voted (when there was a vote), the
 * main party's votes in Parliament, or the career of the person named.
 */
export type ContextChip = { key: string; badge: string; color: string; text: string; href: string };

/** Up to two links to our own pages about the story. */
export function contextChips(story: Story): ContextChip[] {
  const vote = story.initiatives.find((item) => item.lastVote);
  const party = story.parties[0];
  const person = story.deputies[0]
    ? { name: story.deputies[0].name, href: `/deputados/${story.deputies[0].id}` }
    : story.government[0]
      ? { name: story.government[0].name, href: `/governo/${story.government[0].id}` }
      : story.president
        ? { name: story.president.name, href: "/presidente" }
        : null;
  return [
    vote && { key: "vote", badge: "Lei", color: "var(--kind-lei)", text: "Como votou cada partido", href: initiativePath(vote.id) },
    party && {
      key: "party",
      badge: "Partido",
      color: "var(--kind-partido)",
      text: `Votações do ${party.acronym} nesta legislatura`,
      href: `${partyPath(party.slug)}#como-vota`,
    },
    person && { key: "person", badge: "Pessoa", color: "var(--kind-pessoa)", text: person.name, href: person.href },
  ]
    .filter((chip) => Boolean(chip))
    .slice(0, 2) as ContextChip[];
}

export function StoryContext({ story, className = "" }: { story: Story; className?: string }) {
  const chips = contextChips(story);
  if (chips.length === 0) return null;
  return (
    // One row that scrolls sideways on a phone, as in the design; wrapped on wider screens.
    <ul
      aria-label="Saber mais"
      className={`no-scrollbar flex gap-1.5 max-sm:-mr-4 max-sm:overflow-x-auto max-sm:pr-4 sm:flex-wrap ${className}`}
    >
      {chips.map((chip) => (
        <li key={chip.key} className="min-w-0 max-sm:shrink-0 sm:max-w-full">
          <Link
            href={chip.href}
            className="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-[var(--card-line)] bg-[var(--inset)] pl-1.5 pr-2.5 font-mono text-xs hover:border-[var(--card-line-strong)]"
          >
            <span
              className="flex h-[22px] shrink-0 items-center rounded-[5px] border px-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: chip.color, borderColor: `color-mix(in srgb, ${chip.color} 40%, transparent)` }}
            >
              {chip.badge}
            </span>
            <span className="truncate">{chip.text}</span>
            <span aria-hidden="true" className="shrink-0 text-[var(--faint)]">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

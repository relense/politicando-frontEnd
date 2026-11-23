import Link from "next/link";
import { ArticleKindLabel } from "@/components/ArticleKind";
import type { ArticleKind } from "@/lib/types";
import type { ReactNode } from "react";
import { storyPhoto, storyPath, type Story } from "@/lib/api/stories";
import { excerpt, formatCardWhen, formatDateTime, formatNumber } from "@/lib/format";
import { partyPath } from "@/lib/parties";
import type { Article, ArticleParty } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";
import { ArticleMenu } from "./ArticleMenu";
import { CommentIcon } from "./icons";
import { ImportaButton } from "./ImportaButton";
import { PartyLogo } from "./PartyLogo";
import { SaveButton } from "./SaveButton";
import { SourceLogo } from "./SourceLogo";
import { contextChips, leadOf, storyKind } from "./StoryCard";

/**
 * The compact list: one row per news, the headline and a line of text beside a small photo, with the counts, the
 * parties and one link to our pages on a single line. Chosen with the toggle beside the order; the cards stay the default.
 */
type RowProps = {
  path: string;
  title: string;
  text: string;
  imageUrl: string | null;
  source: string;
  sourceDomain: string;
  when: string;
  others: number;
  parties: ArticleParty[];
  commentCount: number;
  /** An article's kind, in gray under the outlet; a story's only when it isn't news. */
  kind?: ArticleKind | null;
  /** Before the comments: the story's Importa, or nothing. */
  lead?: ReactNode;
  /** After the parties: one link to our own pages. */
  extra?: ReactNode;
  menu: ReactNode;
  save: ReactNode;
};

function Row({
  path,
  title,
  text,
  imageUrl,
  source,
  sourceDomain,
  when,
  others,
  parties,
  commentCount,
  kind,
  lead,
  extra,
  menu,
  save,
}: RowProps) {
  return (
    // A thin line between rows; on hover the row lights up as a card does (stronger border, lighter background).
    <article className="group relative -mx-3 flex gap-4 rounded-2xl border border-transparent px-3 py-4 transition-colors [box-shadow:0_1px_0_var(--card-line)] hover:border-[var(--card-line-strong)] hover:bg-[var(--card-bg-hover)] hover:[box-shadow:none] focus-within:border-[var(--card-line-strong)]">
      <div className="min-w-0 flex-1">
        <p className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
          <span className="inline-flex items-center gap-2 font-semibold text-ink">
            <SourceLogo domain={sourceDomain} name={source} size={18} square />
            {source}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={when} title={formatDateTime(when) ?? undefined}>
            {formatCardWhen(when)}
          </time>
          {others > 0 && (
            <span className="rounded bg-[var(--accent-soft)] px-1.5 py-px font-semibold text-[var(--accent)]">
              +{others}
              <span className="max-sm:sr-only"> {others === 1 ? "jornal" : "jornais"}</span>
            </span>
          )}
        </p>
        <ArticleKindLabel kind={kind} className="relative z-10 mt-0.5" />
        <h2 className="mt-1.5 text-[17px] font-semibold leading-snug sm:text-lg">
          <Link href={path} className="decoration-1 underline-offset-4 after:absolute after:inset-0 group-hover:underline">
            {title}
          </Link>
        </h2>
        {text && <p className="mt-1 line-clamp-2 text-sm leading-normal text-[var(--text-excerpt)] max-sm:hidden">{text}</p>}
        <div className="relative z-10 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
          {lead}
          <Link href={`${path}#comentarios`} className="inline-flex items-center gap-1 hover:text-ink [&_svg]:size-3.5">
            <CommentIcon />
            <span className="tabular-nums">{formatNumber(commentCount)}</span>
            <span className="sr-only">{commentCount === 1 ? " comentário" : " comentários"}</span>
          </Link>
          {parties.length > 0 && (
            <ul aria-label="Partidos mencionados" className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {parties.slice(0, 4).map((party, index) => (
                <li key={party.slug} className={index > 1 ? "max-sm:hidden" : ""}>
                  <Link href={partyPath(party.slug)} className="inline-flex items-center gap-1.5 hover:text-ink">
                    <span className="flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                      <PartyLogo slug={party.slug} acronym={party.acronym} size={14} />
                    </span>
                    {party.acronym}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {extra}
          <span className="ml-auto flex items-center">
            {save}
            {menu}
          </span>
        </div>
      </div>
      <ArticleImage
        src={imageUrl}
        alt={title}
        href={path}
        source={source}
        sourceDomain={sourceDomain}
        compact
        className="relative z-10 block h-[72px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-[var(--inset)] sm:h-[88px] sm:w-[132px]"
        imageClassName="size-full object-cover"
      />
    </article>
  );
}

const saveClass = "flex size-8 items-center justify-center rounded-full hover:bg-[var(--button)] hover:text-ink";

export function StoryRow({ story, why }: { story: Story; why: string }) {
  const lead = leadOf(story);
  const chip = contextChips(story)[0];
  return (
    <Row
      path={storyPath(story)}
      title={story.title}
      text={story.excerpt ? excerpt(story.excerpt) : ""}
      imageUrl={storyPhoto(story)?.url ?? null}
      source={lead.source}
      sourceDomain={lead.sourceDomain}
      when={story.lastPublishedAt}
      others={story.sourceCount - 1}
      parties={story.parties}
      commentCount={story.commentCount}
      kind={storyKind(story)}
      lead={
        <ImportaButton
          id={story.id}
          title={story.title}
          importa={story.importa}
          importance={story.importance}
          mergedFrom={story.mergedFrom}
          compact
        />
      }
      extra={
        chip && (
          <Link href={chip.href} className="inline-flex min-w-0 max-w-full items-center gap-1.5 hover:text-ink max-sm:hidden">
            <span className="font-semibold" style={{ color: chip.color }}>
              {chip.badge}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate text-ink">{chip.text}</span>
            <span aria-hidden="true" className="text-[var(--faint)]">
              →
            </span>
          </Link>
        )
      }
      save={<SaveButton articleId={lead.articleId} title={story.title} className={saveClass} iconOnly />}
      menu={
        <ArticleMenu
          article={{ id: lead.articleId, title: story.title, source: lead.source, sourceDomain: lead.sourceDomain, parties: story.parties }}
          why={why}
        />
      }
    />
  );
}

export function ArticleRow({ article, why }: { article: Article; why: string }) {
  return (
    <Row
      path={`/article/${article.id}`}
      title={article.title}
      text={excerpt(article.excerpt)}
      imageUrl={article.imageUrl}
      source={article.source}
      sourceDomain={article.sourceDomain}
      when={article.publishedAt}
      others={0}
      parties={article.parties}
      commentCount={article.commentsCount}
      kind={article.kind}
      save={<SaveButton articleId={article.id} title={article.title} className={saveClass} iconOnly />}
      menu={<ArticleMenu article={article} why={why} />}
    />
  );
}

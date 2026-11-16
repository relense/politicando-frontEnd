import Link from "next/link";
import { editorialPath, KIND_LABELS, readingLabel } from "@/lib/editorial";
import { formatLongDate } from "@/lib/format";
import type { EditorialPost } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";

/** One of our posts in a list: cover, kind, title, subtitle and byline. Opinion is always labelled as such. */
export function EditorialCard({
  post,
  compact = false,
  heading = "h2",
  color = "var(--ink)",
}: {
  post: EditorialPost;
  compact?: boolean;
  heading?: "h2" | "h3";
  /** The kind's colour, for the rule on a card without a cover and the dot by its label. */
  color?: string;
}) {
  const href = editorialPath(post.slug);
  const Heading = heading;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line">
      {post.coverImageUrl ? (
        <ArticleImage
          src={post.coverImageUrl}
          href={href}
          className="block aspect-[16/9] bg-surface"
          imageClassName="size-full object-cover"
        />
      ) : (
        // No cover: a rule in the kind's colour instead of an empty box, and the subtitle says more.
        <div aria-hidden="true" className="h-1" style={{ backgroundColor: color }} />
      )}
      <div className="flex flex-1 flex-col p-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] font-bold uppercase tracking-widest">
          <span
            className={`inline-flex items-center gap-1.5 ${post.kind === "opinion" ? "rounded bg-ink px-1.5 py-0.5 text-paper" : "text-muted"}`}
          >
            {post.kind !== "opinion" && <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />}
            {KIND_LABELS[post.kind]}
          </span>
          {post.featured && <span className="rounded bg-[var(--marker)] px-1.5 py-0.5 text-ink">Em destaque</span>}
        </p>
        <Heading className={`mt-2 font-bold leading-snug ${compact ? "text-base" : "text-lg"}`}>
          <Link href={href} className="hover:underline">
            {post.title}
          </Link>
        </Heading>
        {post.subtitle && (!compact || !post.coverImageUrl) && (
          <p className={`mt-1 text-sm text-muted ${compact ? "line-clamp-3" : ""}`}>{post.subtitle}</p>
        )}
        {!post.coverImageUrl && post.tags.length > 0 && (
          <ul aria-label="Temas" className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <li key={tag} className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px]">
                {tag}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto pt-3 font-mono text-xs text-muted">
          {post.authorName && <>{post.authorName} · </>}
          {formatLongDate(post.publishedAt)}
          {readingLabel(post) && <> · {readingLabel(post)}</>}
        </p>
      </div>
    </div>
  );
}

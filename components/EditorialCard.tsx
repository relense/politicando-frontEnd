import Link from "next/link";
import { editorialPath, KIND_LABELS } from "@/lib/editorial";
import { formatLongDate } from "@/lib/format";
import type { EditorialPost } from "@/lib/types";
import { ArticleImage } from "./ArticleImage";

/** One of our posts in a list: cover, kind, title, subtitle and byline. Opinion is always labelled as such. */
export function EditorialCard({
  post,
  compact = false,
  heading = "h2",
}: {
  post: EditorialPost;
  compact?: boolean;
  heading?: "h2" | "h3";
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
        <div aria-hidden="true" className="aspect-[16/9] bg-surface" />
      )}
      <div className="flex flex-1 flex-col p-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
          <span className={post.kind === "opinion" ? "rounded bg-ink px-1.5 py-0.5 text-paper" : "text-muted"}>
            {KIND_LABELS[post.kind]}
          </span>
        </p>
        <Heading className={`mt-2 font-bold leading-snug ${compact ? "text-base" : "text-lg"}`}>
          <Link href={href} className="hover:underline">
            {post.title}
          </Link>
        </Heading>
        {post.subtitle && !compact && <p className="mt-1 text-sm text-muted">{post.subtitle}</p>}
        <p className="mt-auto pt-3 font-mono text-xs text-muted">
          {post.authorName && <>{post.authorName} · </>}
          {formatLongDate(post.publishedAt)}
        </p>
      </div>
    </div>
  );
}

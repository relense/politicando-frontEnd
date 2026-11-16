import Link from "next/link";
import { RelativeTime } from "@/components/RelativeTime";
import { IDEA_STATUS_LABELS, type ThreadSummary } from "@/lib/api/forums";
import { IdeaVote } from "./IdeaVote";

/** One idea, like a Reddit post: the vote on the left, the rest opens the idea. */
export function IdeaCard({ idea, compact = false }: { idea: ThreadSummary; compact?: boolean }) {
  const status = idea.status ? IDEA_STATUS_LABELS[idea.status] : null;
  // Compact cards sit under a section heading (h2), so they go one level down.
  const Heading = compact ? "h3" : "h2";
  return (
    <article className={`relative flex gap-3 rounded-2xl border border-line hover:bg-surface ${compact ? "p-3" : "p-4"}`}>
      <IdeaVote id={idea.id} title={idea.title} score={idea.score ?? 0} closed={idea.status === "done" || idea.status === "declined"} />
      <div className="min-w-0 flex-1">
        <Heading className={`break-words font-bold leading-snug ${compact ? "text-base" : "text-lg"}`}>
          {/* The whole card opens the idea through this link's overlay; the vote sits above it. */}
          <Link href={`/feedback/ideias/${idea.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {idea.title}
          </Link>
        </Heading>
        {!compact && idea.excerpt && <p className="mt-1 line-clamp-2 break-words text-muted">{idea.excerpt}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
          {status && (
            <span className="rounded-full border px-2 py-0.5 font-bold" style={{ color: status.color, borderColor: status.color }}>
              {status.label}
            </span>
          )}
          <span>{idea.replyCount === 1 ? "1 comentário" : `${idea.replyCount} comentários`}</span>
          {!compact && (
            <>
              <span aria-hidden="true">·</span>
              <RelativeTime value={idea.createdAt} />
            </>
          )}
        </p>
      </div>
    </article>
  );
}

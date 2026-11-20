import Link from "next/link";
import { RelativeTime } from "@/components/RelativeTime";
import { IdeaVote } from "@/components/forum/IdeaVote";
import type { ThreadSummary } from "@/lib/api/forums";
import { commentsLabel } from "@/lib/ideas";
import { DiscussingNow, IdeaStatusBadge } from "./IdeaBits";

export const ideaPath = (id: number) => `/feedback/ideias/${id}`;
/** Done, declined or a duplicate: no more votes there. */
export const ideaClosed = (idea: Pick<ThreadSummary, "status">) =>
  idea.status === "done" || idea.status === "declined" || idea.status === "duplicate";

/** One idea on the board: the vote on the left; the title, a line of it, the team's answer when there is one, the status. */
export function IdeaRow({ idea }: { idea: ThreadSummary }) {
  return (
    <article className="relative flex gap-3 border-b border-line py-4">
      <IdeaVote id={idea.id} title={idea.title} score={idea.score ?? 0} closed={ideaClosed(idea)} />
      <div className="min-w-0 flex-1">
        <h3 className="break-words font-serif text-lg font-bold leading-snug">
          <Link href={ideaPath(idea.id)} className="hover:underline">
            {idea.title}
          </Link>
        </h3>
        {idea.excerpt && <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted">{idea.excerpt}</p>}
        {idea.answer && (
          <div className="mt-2 rounded-lg border-l-2 border-[var(--stage-approved)] bg-surface px-3 py-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--stage-approved)]">Resposta da equipa</p>
            <p className="mt-0.5 line-clamp-3 break-words text-sm">{idea.answer}</p>
          </div>
        )}
        {idea.duplicateOf && (
          <p className="mt-2 text-sm text-muted">
            Já foi sugerida:{" "}
            <Link href={ideaPath(idea.duplicateOf.id)} className="text-link underline">
              {idea.duplicateOf.title}
            </Link>
          </p>
        )}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
          <IdeaStatusBadge status={idea.status} />
          <Link href={`${ideaPath(idea.id)}#comentarios`} className="underline hover:text-ink">
            {commentsLabel(idea.replyCount)}
          </Link>
          <RelativeTime value={idea.createdAt} />
          <DiscussingNow idea={idea} />
        </p>
      </div>
    </article>
  );
}

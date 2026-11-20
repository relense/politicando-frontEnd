"use client";

import { IDEA_STATUS_LABELS, type IdeaStatus, type ThreadSummary } from "@/lib/api/forums";
import { discussingNow } from "@/lib/ideas";
import { useNow } from "@/lib/useNow";

/** «● Em desenvolvimento»: the team's status, in its colour. Nothing while nobody from the team has looked. */
export function IdeaStatusBadge({ status }: { status: IdeaStatus | null }) {
  if (!status) return null;
  const { label, color } = IDEA_STATUS_LABELS[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span aria-hidden="true">●</span>
      {label}
    </span>
  );
}

/** «● a discutir agora»: someone replied in the last hour. */
export function DiscussingNow({ idea }: { idea: Pick<ThreadSummary, "replyCount" | "bumpedAt"> }) {
  const now = useNow();
  if (!discussingNow(idea, now)) return null;
  return (
    <span className="font-mono text-[11px] font-bold text-[var(--stage-approved)]">
      <span aria-hidden="true">● </span>a discutir agora
    </span>
  );
}

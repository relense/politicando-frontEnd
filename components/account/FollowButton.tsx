"use client";

import { useState } from "react";
import { useAccountGate, useReader } from "@/lib/account";
import { follow, useExtras } from "@/lib/accountExtras";
import type { FollowKind } from "@/lib/api/engagement";

/**
 * "Seguir": the account is told when a forum thread gets new replies, or more outlets cover a story (backend
 * docs/engagement-api.md). Replying in a thread or commenting on a story follows it already, so "A seguir" shows
 * and pressing it again stops.
 */
export function FollowButton({
  kind,
  id,
  mergedFrom = [],
  large = false,
  className = "",
}: {
  kind: FollowKind;
  id: number;
  /** A story's older ids, joined into it: following one of them is following this. */
  mergedFrom?: readonly number[];
  large?: boolean;
  className?: string;
}) {
  const reader = useReader();
  const followed = useExtras().follows[kind];
  const followedIds = [id, ...mergedFrom].filter((each) => followed.includes(each));
  const following = followedIds.length > 0 && Boolean(reader);
  const gate = useAccountGate();
  const [failed, setFailed] = useState(false);
  const what = kind === "story" ? "esta história" : "esta discussão";

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        aria-pressed={following}
        onClick={(event) => {
          if (gate("follow", event.currentTarget)) return;
          setFailed(false);
          // Stopping stops every id it was followed under.
          const done = following ? Promise.all(followedIds.map((each) => follow(kind, each, false))) : follow(kind, id, true);
          done.catch(() => setFailed(true));
        }}
        className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold ${large ? "h-10 rounded-xl px-4" : "h-[34px] rounded-full px-3"} ${
          following
            ? "border border-[color-mix(in_srgb,#f2c94c_45%,transparent)] bg-[color-mix(in_srgb,#f2c94c_12%,transparent)] text-[#8a6500] dark:text-[#f2c94c]"
            : "border border-line hover:bg-surface"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
          {following ? <path d="m5 12 4.5 4.5L19 7" /> : <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />}
        </svg>
        {large
          ? following
            ? `A seguir ${what}`
            : `Seguir ${what}`
          : `${following ? "A seguir" : "Seguir"}${kind === "thread" ? " conversa" : ""}`}
        {!large && <span className="sr-only"> {what}</span>}
      </button>
      {failed && (
        <span role="alert" className="mt-1 font-mono text-[11px] text-muted">
          Não foi possível. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

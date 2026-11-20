"use client";

import { useState, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { votePost } from "@/lib/api/forums";
import { useAccountGate } from "@/lib/account";

// The replies this reader voted for, kept on the device (and filled from the account: /me/state › votes.forumPosts).
const KEY = "idea-replies-voted";
const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const subscribe = (callback: () => void) => {
  window.addEventListener(KEY, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(KEY, callback);
    window.removeEventListener("storage", callback);
  };
};
const remember = (id: number) => {
  try {
    window.localStorage.setItem(KEY, [...new Set(read().split(",").filter(Boolean)).add(String(id))].join(","));
  } catch {
    // Not remembered on this device.
  }
  window.dispatchEvent(new Event(KEY));
};

/** «▲ 14»: a vote for a reply on an idea. An account, once, no undo. */
export function ReplyVote({ id, score, author }: { id: number; score: number; author: string }) {
  const stored = useSyncExternalStore(subscribe, read, () => "");
  const [count, setCount] = useState(score);
  const [failed, setFailed] = useState(false);
  const voted = stored.split(",").includes(String(id)) && !failed;
  const gate = useAccountGate();

  async function vote(button: HTMLElement) {
    if (gate("like", button)) return;
    setFailed(false);
    setCount((current) => current + 1);
    remember(id);
    try {
      setCount(await votePost(id));
    } catch (error) {
      setCount(score);
      setFailed(true);
      if (!(error instanceof ApiError)) throw error;
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={(event) => void vote(event.currentTarget)}
        disabled={voted}
        aria-pressed={voted}
        aria-label={`${voted ? "Votaste no comentário de" : "Votar no comentário de"} ${author}, ${count} ${count === 1 ? "voto" : "votos"}`}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px] font-bold disabled:cursor-default ${
          voted ? "text-[var(--stage-debate)]" : "text-muted hover:bg-surface hover:text-ink"
        }`}
      >
        <span aria-hidden="true">▲</span>
        {count}
      </button>
      {failed && (
        <span role="alert" className="text-[10px] text-danger">
          Não contou.
        </span>
      )}
    </span>
  );
}

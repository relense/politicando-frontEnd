"use client";

import { useState, useSyncExternalStore } from "react";
import { ApiError, likeComment } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { useAccountGate } from "@/lib/account";
import { publishAnswer, useAnswer } from "@/lib/liveAnswers";

// The comments this reader liked, kept on the device. Storage may be blocked: then the button still works this visit.
const KEY = "comment-likes";
const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
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
const parse = (raw: string): number[] => {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
};
function remember(id: number, on: boolean) {
  try {
    const ids = parse(read()).filter((item) => item !== id);
    window.localStorage.setItem(KEY, JSON.stringify((on ? [...ids, id] : ids).slice(-500)));
    window.dispatchEvent(new Event(KEY));
  } catch {
    // Not remembered on this device.
  }
}

type LikeAnswer = { likes: number; mine: number };

/** A comment this reader just posted: liked when the API counted the author's own like (likes 1; an older API answers 0). */
export function markOwnLike(comment: { id: number; likes?: number }) {
  if ((comment.likes ?? 0) > 0) remember(comment.id, true);
}

/** An answer from outside the button (the like finished after logging in). */
export function applyLikeAnswer(id: number, answer: LikeAnswer) {
  remember(id, answer.mine === 1);
  publishAnswer("like", id, answer);
}

/** "▲ 9": one like per reader per comment; pressing again takes it back. */
export function CommentLike({ id, likes, name }: { id: number; likes: number; name: string }) {
  const remembered = parse(useSyncExternalStore(subscribe, read, () => "[]")).includes(id);
  const [state, setState] = useState<{ likes: number; mine: boolean | null }>({ likes, mine: null });
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const was = state.mine ?? remembered;
  const mine = pending ?? was;
  useAnswer<LikeAnswer>("like", id, (answer) => setState({ likes: answer.likes, mine: answer.mine === 1 }));
  const count = state.likes + (pending === null || pending === was ? 0 : pending ? 1 : -1);

  const gate = useAccountGate();
  async function toggle(button: HTMLElement) {
    const next = !mine;
    if (next && gate("like", button, { kind: "like", id })) return;
    setPending(next);
    setFailed(false);
    try {
      const answer = await likeComment(id, next ? 1 : 0);
      remember(id, answer.mine === 1);
      setState({ likes: answer.likes, mine: answer.mine === 1 });
    } catch (error) {
      // Needs an account: the login prompt opens instead (components/account/AccountRuntime).
      if (!(error instanceof ApiError && error.code === "login_required")) setFailed(true);
    } finally {
      setPending(null);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-pressed={mine}
        onClick={(event) => void toggle(event.currentTarget)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-bold hover:bg-surface ${mine ? "text-[var(--accent)]" : "text-muted hover:text-ink"}`}
      >
        <span aria-hidden="true">▲</span>
        <span className="tabular-nums">{formatNumber(count)}</span>
        <span className="sr-only"> gostos no comentário de {name}</span>
      </button>
      {failed && (
        <span role="alert" className="absolute left-0 top-full whitespace-nowrap text-[11px] font-normal text-danger">
          Não contou. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

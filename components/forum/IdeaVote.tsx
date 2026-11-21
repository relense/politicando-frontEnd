"use client";

import { useState, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { voteThread } from "@/lib/api/forums";
import { useAccountGate, useReader } from "@/lib/account";
import { markFollowed } from "@/lib/accountExtras";
import { publishAnswer, useAnswer } from "@/lib/liveAnswers";

// Which ideas this reader voted for, kept on the device. It may be blocked: then the button simply stays open,
// and the API still counts one vote per reader.
const KEY = "ideas-voted";
const EVENT = "ideas-voted";
const readVoted = () => {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};
const remember = (id: number) => {
  try {
    const ids = new Set(readVoted().split(",").filter(Boolean)).add(String(id));
    window.localStorage.setItem(KEY, [...ids].join(","));
  } catch {
    // Not remembered on this device.
  }
  window.dispatchEvent(new Event(EVENT));
};
/** The vote didn't count: not remembered, so the button works again after a reload. */
const forget = (id: number) => {
  try {
    const ids = readVoted()
      .split(",")
      .filter((value) => value && value !== String(id));
    window.localStorage.setItem(KEY, ids.join(","));
  } catch {
    // Nothing remembered to take back.
  }
  window.dispatchEvent(new Event(EVENT));
};

/** An answer from outside the button (the vote finished after logging in). */
export function applyIdeaAnswer(id: number, score: number) {
  remember(id);
  publishAnswer("idea", id, score);
}

/**
 * The upvote on an idea, Reddit style: an arrow over the score. Closed ideas (done or declined) take no more votes.
 * `pill`: «É esta · votar ▲ 6», for the similar ideas shown before posting a new one.
 */
export function IdeaVote({
  id,
  title,
  score,
  closed = false,
  pill = false,
}: {
  id: number;
  title: string;
  score: number;
  closed?: boolean;
  pill?: boolean;
}) {
  const stored = useSyncExternalStore(subscribe, readVoted, () => "");
  const [count, setCount] = useState(score);
  useAnswer<number>("idea", id, setCount);
  // "account": the API asked for one, and the login prompt opened instead of an error.
  const [failed, setFailed] = useState<false | "error" | "account">(false);
  const voted = stored.split(",").includes(String(id)) && !failed;

  const gate = useAccountGate();
  const reader = useReader();
  async function vote(button: HTMLElement) {
    if (gate("idea", button, { kind: "idea", id })) return;
    setFailed(false);
    setCount((current) => current + 1);
    remember(id);
    try {
      setCount(await voteThread(id));
      // Voting on an idea follows it: the reader hears when its status changes.
      if (reader) markFollowed("thread", id);
    } catch (error) {
      setCount(score);
      forget(id);
      setFailed(error instanceof ApiError && error.code === "login_required" ? "account" : "error");
    }
  }

  if (pill)
    return (
      <span className="flex shrink-0 flex-col items-end">
        <button
          type="button"
          onClick={(event) => void vote(event.currentTarget)}
          disabled={voted || closed}
          aria-pressed={voted}
          className={`rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold disabled:cursor-default ${
            voted ? "border-[var(--stage-debate)] text-[var(--stage-debate)]" : "border-line hover:border-ink hover:bg-surface"
          }`}
        >
          {voted ? "Votaste" : "É esta · votar"}
          <span className="sr-only"> em «{title}»,</span> <span aria-hidden="true">▲</span> {count}
          <span className="sr-only"> {count === 1 ? "voto" : "votos"}</span>
        </button>
        {failed === "error" && (
          <span role="alert" className="mt-1 text-[10px] leading-tight text-danger">
            Não contou. Tenta outra vez.
          </span>
        )}
      </span>
    );

  return (
    <span className="relative z-10 flex w-12 shrink-0 flex-col items-center">
      <button
        type="button"
        onClick={(event) => void vote(event.currentTarget)}
        disabled={voted || closed}
        aria-pressed={voted}
        aria-label={`${voted ? "Votaste em" : "Votar em"} «${title}», ${count} ${count === 1 ? "voto" : "votos"}`}
        className={`flex w-full flex-col items-center rounded-xl border py-1.5 font-mono text-sm font-bold disabled:cursor-default ${
          voted ? "border-[var(--stage-debate)] text-[var(--stage-debate)]" : "border-line hover:border-ink hover:bg-surface"
        }`}
      >
        <span aria-hidden="true" className="text-xs leading-none">
          ▲
        </span>
        {count}
      </button>
      {failed === "error" && (
        <span role="alert" className="mt-1 text-center text-[10px] leading-tight text-danger">
          Não contou. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import { voteThread } from "@/lib/api/forums";

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

/** The upvote on an idea, Reddit style: an arrow over the score. Closed ideas (done or declined) take no more votes. */
export function IdeaVote({ id, title, score, closed = false }: { id: number; title: string; score: number; closed?: boolean }) {
  const stored = useSyncExternalStore(subscribe, readVoted, () => "");
  const [count, setCount] = useState(score);
  const [failed, setFailed] = useState(false);
  const voted = stored.split(",").includes(String(id)) && !failed;

  async function vote() {
    setFailed(false);
    setCount((current) => current + 1);
    remember(id);
    try {
      setCount(await voteThread(id));
    } catch {
      setCount(score);
      setFailed(true);
    }
  }

  return (
    <span className="relative z-10 flex w-12 shrink-0 flex-col items-center">
      <button
        type="button"
        onClick={vote}
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
      {failed && (
        <span role="alert" className="mt-1 text-center text-[10px] leading-tight text-danger">
          Não contou. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

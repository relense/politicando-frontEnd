"use client";

import { useState, useSyncExternalStore } from "react";
import { voteArticle, votePost } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";

// This reader's votes on news, kept on the device as {"12":1,"40":-1}. Storage may be blocked: then the arrows simply
// don't stay lit after a reload, and the API still keeps one vote per reader.
const KEY = "article-votes";
const EVENT = "article-votes";
const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
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
function parse(raw: string): Record<string, number> {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function remember(id: number | string, value: number) {
  try {
    const votes = parse(read());
    if (value === 0) delete votes[id];
    else votes[id] = value;
    window.localStorage.setItem(KEY, JSON.stringify(votes));
  } catch {
    // Not remembered on this device.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** A news article by id, or a blog post as "post:slug" (kept beside the articles' ids). */
type Props = { id: number | string; title: string; up: number; down: number; className?: string };

/** Up and down arrows around the score (up minus down), as on Reddit. Pressing a lit arrow again takes the vote back. */
export function ArticleVote({ id, title, up, down, className = "" }: Props) {
  const stored = useSyncExternalStore(subscribe, read, () => "{}");
  const remembered = parse(stored)[id] ?? 0;
  // The totals as last answered by the API (or as the page came), and the vote the reader just made, if any.
  const [totals, setTotals] = useState({ up, down, mine: remembered });
  const [pending, setPending] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const mine = pending ?? (totals.mine || remembered);

  // While a vote travels, the score moves at once.
  const shown = (() => {
    if (pending === null) return totals;
    const base = { up: totals.up - (totals.mine === 1 ? 1 : 0), down: totals.down - (totals.mine === -1 ? 1 : 0) };
    return { up: base.up + (pending === 1 ? 1 : 0), down: base.down + (pending === -1 ? 1 : 0), mine: pending };
  })();
  const score = shown.up - shown.down;

  async function vote(value: 1 | -1) {
    const next = mine === value ? 0 : value;
    setFailed(false);
    setPending(next);
    try {
      const answer = typeof id === "number" ? await voteArticle(id, next) : await votePost(id.replace(/^post:/, ""), next);
      setTotals(answer);
      remember(id, answer.mine);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  const arrow = (value: 1 | -1) =>
    `flex size-9 items-center justify-center rounded-full hover:bg-line ${
      mine === value ? (value === 1 ? "text-[var(--vote-up)]" : "text-[var(--vote-down)]") : "text-muted hover:text-ink"
    }`;

  return (
    <span
      className={`relative inline-flex h-[38px] items-center rounded-full font-mono text-[12.5px] font-medium ${
        mine === 1 ? "bg-[var(--accent-soft)]" : "bg-[var(--button)]"
      } ${className}`}
    >
      <button
        type="button"
        aria-pressed={mine === 1}
        aria-label={`Votar a favor de «${title}»`}
        onClick={() => void vote(1)}
        className={arrow(1)}
      >
        <Arrow up filled={mine === 1} />
      </button>
      <span
        className={`min-w-6 text-center tabular-nums ${mine === 1 ? "text-[var(--vote-up)]" : ""}`}
        aria-live="polite"
        aria-label={`Pontuação: ${score}`}
      >
        {formatNumber(score)}
      </span>
      <button
        type="button"
        aria-pressed={mine === -1}
        aria-label={`Votar contra «${title}»`}
        onClick={() => void vote(-1)}
        className={arrow(-1)}
      >
        <Arrow filled={mine === -1} />
      </button>
      {failed && (
        <span role="alert" className="absolute left-0 top-full mt-1 whitespace-nowrap text-[11px] font-normal text-danger">
          O voto não contou. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

function Arrow({ up = false, filled }: { up?: boolean; filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-4 ${up ? "" : "rotate-180"}`} strokeWidth="1.7" stroke="currentColor">
      <path d="M10 3 3.5 10H7v6.5h6V10h3.5L10 3Z" strokeLinejoin="round" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

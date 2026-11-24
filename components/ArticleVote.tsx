"use client";

import { useState, useSyncExternalStore } from "react";
import { ApiError, voteArticle } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { useAccountGate } from "@/lib/account";
import { standingShort } from "@/lib/api/account";
import { publishAnswer, useAnswer } from "@/lib/liveAnswers";

const FAILED = "O voto não contou. Tenta outra vez.";

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

/** The same store for blog posts' "Importa", kept as "post:slug": 1 (components/PostImporta.tsx). */
export const voteStore = { read, subscribe, parse, remember };

type VoteAnswer = { up: number; down: number; mine: number };

/** An answer from outside the arrows (the vote finished after logging in). */
export function applyVoteAnswer(id: number, answer: VoteAnswer) {
  remember(id, answer.mine);
  publishAnswer("vote", id, answer);
}

/** A news article, by id. (Blog posts have "Importa" instead: components/PostImporta.tsx.) */
type Props = { id: number; title: string; up: number; down: number; className?: string };

/** Up and down arrows around the score (up minus down), as on Reddit. Pressing a lit arrow again takes the vote back. */
export function ArticleVote({ id, title, up, down, className = "" }: Props) {
  const stored = useSyncExternalStore(subscribe, read, () => "{}");
  const remembered = parse(stored)[id] ?? 0;
  // The totals as last answered by the API (or as the page came), and the vote the reader just made, if any.
  const [totals, setTotals] = useState({ up, down, mine: remembered });
  const [pending, setPending] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const mine = pending ?? (totals.mine || remembered);
  useAnswer<VoteAnswer>("vote", id, setTotals);

  // While a vote travels, the score moves at once.
  const shown = (() => {
    if (pending === null) return totals;
    const base = { up: totals.up - (totals.mine === 1 ? 1 : 0), down: totals.down - (totals.mine === -1 ? 1 : 0) };
    return { up: base.up + (pending === 1 ? 1 : 0), down: base.down + (pending === -1 ? 1 : 0), mine: pending };
  })();
  const score = shown.up - shown.down;

  const gate = useAccountGate();
  async function vote(value: 1 | -1, button: HTMLElement) {
    const next = mine === value ? 0 : value;
    if (next !== 0 && gate("vote", button, { kind: "vote", id, value })) return;
    setFailed(null);
    setPending(next);
    try {
      const answer = await voteArticle(id, next);
      setTotals(answer);
      remember(id, answer.mine);
    } catch (error) {
      // Needs an account: the login prompt opens instead (components/account/AccountRuntime).
      if (!(error instanceof ApiError && error.code === "login_required")) setFailed(standingShort(error) ?? FAILED);
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
        onClick={(event) => void vote(1, event.currentTarget)}
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
        onClick={(event) => void vote(-1, event.currentTarget)}
        className={arrow(-1)}
      >
        <Arrow filled={mine === -1} />
      </button>
      {failed && (
        <span role="alert" className="absolute left-0 top-full mt-1 whitespace-nowrap text-[11px] font-normal text-danger">
          {failed}
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

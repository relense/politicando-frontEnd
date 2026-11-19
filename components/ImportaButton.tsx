"use client";

import { useState, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { markImporta } from "@/lib/api/stories";
import { formatNumber } from "@/lib/format";
import { useAccountGate } from "@/lib/account";
import { track } from "@/lib/analytics";

// The stories this reader marked "Importa", kept on the device as {"29":1}, to draw the button filled. Storage may be
// blocked: then it isn't filled after a reload, and the API still keeps one mark per reader.
const KEY = "story-importa";
const read = () => {
  try {
    return window.localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
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
const parse = (raw: string): Record<string, number> => {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, number>) : {};
  } catch {
    return {};
  }
};
function remember(id: number, marked: boolean) {
  try {
    const marks = parse(read());
    if (marked) marks[id] = 1;
    else delete marks[id];
    window.localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    // Not remembered on this device.
  }
  window.dispatchEvent(new Event(KEY));
}

// The latest answer for each story this visit, shared by every button and count of the same story: pages are cached
// for a minute, so after a mark the next page can still carry the old number.
type Live = { importa: number; importance: number; mine: boolean };
const live = new Map<number, Live>();
const LIVE_EVENT = "story-importa-live";
const subscribeLive = (callback: () => void) => {
  window.addEventListener(LIVE_EVENT, callback);
  return () => window.removeEventListener(LIVE_EVENT, callback);
};
function setLive(id: number, value: Live) {
  live.set(id, value);
  window.dispatchEvent(new Event(LIVE_EVENT));
}
const useLive = (id: number) =>
  useSyncExternalStore(
    subscribeLive,
    () => live.get(id) ?? null,
    () => null,
  );

type ImportaAnswer = { importa: number; importance: number; mine: number };

/** An answer from outside the buttons (the mark finished after logging in): every button of the story follows. */
export function applyImportaAnswer(id: number, answer: ImportaAnswer) {
  remember(id, answer.mine === 1);
  setLive(id, { importa: answer.importa, importance: answer.importance, mine: answer.mine === 1 });
}

/** What to show for a story: this visit's latest answer, or the page's numbers with the reader's own mark counted. */
function useImporta(id: number, importa: number, importance: number) {
  const stored = useSyncExternalStore(subscribe, read, () => "{}");
  const current = useLive(id);
  const mine = current?.mine ?? parse(stored)[id] === 1;
  // A cached page may not count the reader's own mark yet.
  return { importa: current?.importa ?? Math.max(importa, mine ? 1 : 0), importance: current?.importance ?? importance, mine };
}

/** The number of readers who say a story matters, kept in step with the story's Importa buttons. */
export function ImportaCount({
  id,
  importa,
  importance,
  headingId = "importa",
}: {
  id: number;
  importa: number;
  importance: number;
  /** Unique on the page: the article page shows the box twice (before the comments on phones, in the column on wide screens). */
  headingId?: string;
}) {
  const shown = useImporta(id, importa, importance);
  return (
    <>
      <ImportanceDots importance={shown.importance} className="w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id={headingId} className="text-2xl font-bold leading-none">
          {formatNumber(shown.importa)}
        </h2>
        <p className="font-mono text-[11px] text-muted">{shown.importa === 1 ? "leitor diz que importa" : "leitores dizem que importa"}</p>
      </div>
    </>
  );
}

const DOTS = 11;

/** A semicircle of dots, filled by `importance` (0–1): how this story compares with the others of the last 24 hours. */
export function ImportanceDots({ importance, className = "h-[19px] w-[34px]" }: { importance: number; className?: string }) {
  const filled = Math.round(importance * DOTS);
  return (
    <svg aria-hidden="true" viewBox="-12 -12 24 13" className={className}>
      {Array.from({ length: DOTS }, (_, index) => {
        const angle = Math.PI - (index / (DOTS - 1)) * Math.PI;
        return (
          <circle
            key={index}
            cx={10 * Math.cos(angle)}
            cy={-10 * Math.sin(angle)}
            r={1.9}
            fill={index < filled ? "var(--accent)" : "var(--dot-empty)"}
          />
        );
      })}
    </svg>
  );
}

/**
 * "Importa": how much a story matters, not whether the reader liked it. One mark, no down-vote, so nobody can bury the
 * news about the party they dislike. Pressing again takes the mark back.
 */
export function ImportaButton({
  id,
  title,
  importa,
  importance,
  compact = false,
}: {
  id: number;
  title: string;
  importa: number;
  importance: number;
  /** The compact list: the dots and the count, no pill. */
  compact?: boolean;
}) {
  const state = useImporta(id, importa, importance);
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const mine = pending ?? state.mine;
  // While the mark travels, the count moves at once.
  const count = pending === null || pending === state.mine ? state.importa : Math.max(0, state.importa + (pending ? 1 : -1));

  const gate = useAccountGate();
  async function toggle(button: HTMLElement) {
    const next = !mine;
    if (next && gate("importa", button, { kind: "importa", id })) return;
    setPending(next);
    setFailed(false);
    try {
      applyImportaAnswer(id, await markImporta(id, next ? 1 : 0));
      if (next) track("importa", { where: "story", story: id });
    } catch (error) {
      // Needs an account: the login prompt opens instead (components/account/AccountRuntime).
      if (!(error instanceof ApiError && error.code === "login_required")) setFailed(true);
    } finally {
      setPending(null);
    }
  }

  return (
    <span className="relative z-10 inline-flex flex-col">
      {compact ? (
        <button
          type="button"
          aria-pressed={mine}
          onClick={(event) => void toggle(event.currentTarget)}
          className={`-mx-1.5 inline-flex h-7 items-center gap-1 rounded-full px-1.5 font-mono text-xs ${
            mine ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "hover:bg-[var(--button)]"
          }`}
        >
          <ImportanceDots importance={state.importance} className="h-3 w-[22px]" />
          <span className={`font-semibold tabular-nums ${mine ? "" : "text-ink"}`}>{formatNumber(count)}</span>
          <span className="sr-only"> Importa: leitores dizem que «{title}» importa</span>
        </button>
      ) : (
        <button
          type="button"
          aria-pressed={mine}
          onClick={(event) => void toggle(event.currentTarget)}
          className={`inline-flex h-[38px] items-center gap-[7px] rounded-full pl-2.5 pr-3.5 font-mono text-[12.5px] font-medium ${
            mine ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--button)] hover:bg-[var(--button-hover)]"
          }`}
        >
          <ImportanceDots importance={state.importance} />
          <span className="max-sm:sr-only">Importa</span>{" "}
          <span className={`tabular-nums ${mine ? "" : "text-muted"}`}>{formatNumber(count)}</span>
          <span className="sr-only"> leitores dizem que «{title}» importa</span>
        </button>
      )}
      {failed && (
        <span role="alert" className="mt-1 font-mono text-[11px] text-muted">
          Não contou. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

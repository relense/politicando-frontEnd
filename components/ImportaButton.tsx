"use client";

import { useState, useSyncExternalStore } from "react";
import { markImporta } from "@/lib/api/stories";
import { formatNumber } from "@/lib/format";

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
  const stored = useSyncExternalStore(subscribe, read, () => "{}");
  const remembered = parse(stored)[id] === 1;
  const [state, setState] = useState<{ importa: number; importance: number; mine: boolean | null }>({ importa, importance, mine: null });
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const mine = pending ?? state.mine ?? remembered;
  // While the mark travels, the count moves at once.
  const count = pending === null ? state.importa : state.importa + (pending === (state.mine ?? remembered) ? 0 : pending ? 1 : -1);

  async function toggle() {
    const next = !mine;
    setPending(next);
    setFailed(false);
    try {
      const answer = await markImporta(id, next ? 1 : 0);
      remember(id, answer.mine === 1);
      setState({ importa: answer.importa, importance: answer.importance, mine: answer.mine === 1 });
    } catch {
      setFailed(true);
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
          onClick={() => void toggle()}
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
          onClick={() => void toggle()}
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

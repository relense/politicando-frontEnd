"use client";

import { useAccountGate } from "@/lib/account";
import { toggleIn, updateReaderPrefs, useReaderPrefs } from "@/lib/readerPrefs";

/** "Guardar" as a pill on the card: the same list as the "…" menu's, kept in the account (see /guardadas). */
export function SaveButton({
  articleId,
  title,
  className,
  iconOnly = false,
}: {
  articleId: number;
  title: string;
  className: string;
  /** Just the icon (the compact list); the words stay for screen readers. */
  iconOnly?: boolean;
}) {
  const { saved } = useReaderPrefs();
  const gate = useAccountGate();
  const on = saved.includes(articleId);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={(event) => {
        if (gate("save", event.currentTarget)) return;
        updateReaderPrefs((current) => ({ ...current, saved: toggleIn(current.saved, articleId) }));
      }}
      className={`${className} ${on ? "text-[var(--accent)]" : ""}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="M6 3h8a1 1 0 0 1 1 1v13l-5-3.5L5 17V4a1 1 0 0 1 1-1Z" />
      </svg>
      <span className={iconOnly ? "sr-only" : "max-sm:sr-only"}>{on ? "Guardada" : "Guardar"}</span>
      <span className="sr-only"> «{title}»</span>
    </button>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { accountMarkRead } from "@/lib/account";
import { freshnessLine, storyPath, type Story } from "@/lib/api/stories";
import { useNow } from "@/lib/useNow";
import { umamiEvent } from "@/lib/analytics";

// The stories this reader opened, kept on the device (the last 200 ids), for the ticks in "Hoje em 5". Storage may be
// blocked: then nothing is ticked, and the box still works as a list.
const KEY = "stories-read";
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

/** On a story's page: remembers it was opened. Renders nothing. */
export function MarkStoryRead({ id }: { id: number }) {
  useEffect(() => {
    try {
      const ids = parse(read()).filter((item) => item !== id);
      window.localStorage.setItem(KEY, JSON.stringify([...ids, id].slice(-200)));
    } catch {
      // Not remembered on this device.
    }
    accountMarkRead(id);
  }, [id]);
  return null;
}

/**
 * "Hoje em 5": the five stories of the last 24 hours that matter most, ticked as the reader opens them. The set changes
 * during the day, so the ticks compare ids; with all five opened, "Estás em dia".
 */
export function TodayInFive({ stories, headingId = "hoje-em-5" }: { stories: Story[]; headingId?: string }) {
  const opened = parse(useSyncExternalStore(subscribe, read, () => "[]"));
  const done = stories.filter((story) => opened.includes(story.id)).length;
  const all = done === stories.length;
  const now = useNow();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-[color-mix(in_srgb,var(--vote-up)_45%,var(--line))] bg-[var(--card-hover)] p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--vote-up)]">
          Hoje em {stories.length}
        </h2>
        <span className="font-mono text-[11px] font-bold" suppressHydrationWarning>
          {all ? "Estás em dia ✓" : `${done} de ${stories.length}`}
        </span>
      </div>
      <p className="font-mono text-[11px] text-muted">o essencial das últimas 24 horas</p>
      <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-[var(--vote-up)] transition-[width]"
          style={{ width: `${(done / Math.max(1, stories.length)) * 100}%` }}
        />
      </div>
      <ol className="mt-2 divide-y divide-line">
        {stories.map((story, index) => {
          const seen = opened.includes(story.id);
          return (
            <li key={story.id} className="flex items-start gap-3 py-2.5">
              <span className={`w-4 shrink-0 text-lg font-bold leading-tight ${seen ? "text-muted" : "text-[var(--vote-up)]"}`}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={storyPath(story)}
                  {...umamiEvent("hoje-em-5-open", { position: index + 1 })}
                  className={`font-bold leading-snug hover:underline ${seen ? "text-muted" : ""}`}
                >
                  {story.title}
                </Link>
                <span className="mt-0.5 block font-mono text-[11px] text-muted" suppressHydrationWarning>
                  {freshnessLine(story, now)}
                </span>
              </span>
              <span
                aria-label={seen ? "Já leste" : "Por ler"}
                role="img"
                className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  seen ? "border-[var(--stage-law)] bg-[var(--stage-law)] text-paper" : "border-line"
                }`}
                suppressHydrationWarning
              >
                {seen && "✓"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

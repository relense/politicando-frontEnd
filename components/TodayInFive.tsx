"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { accountMarkRead } from "@/lib/account";
import { freshnessLine, knowsStory, storyPath, type Story } from "@/lib/api/stories";
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
 * "Hoje em 5": the five stories of the last 24 hours that matter most, one at a time, like steps in a game. It opens on
 * the first one not read yet; arrows and a dot per story go back and forth (a dot filled is read). The set changes
 * during the day, so the ticks compare ids; with all five opened, "Estás em dia" and it starts again from the first.
 */
export function TodayInFive({ stories, headingId = "hoje-em-5" }: { stories: Story[]; headingId?: string }) {
  const opened = parse(useSyncExternalStore(subscribe, read, () => "[]"));
  // A story joined from older ones counts as read when one of those was opened.
  const done = stories.filter((story) => knowsStory(opened, story)).length;
  const all = done === stories.length;
  const now = useNow();
  // Where the reader is: the story they moved to, or else the first not read (the first again with all read).
  const [picked, setPicked] = useState<number | null>(null);
  const firstUnread = stories.findIndex((item) => !knowsStory(opened, item));
  const current = Math.min(picked ?? Math.max(0, firstUnread), Math.max(0, stories.length - 1));
  const story = stories[current];
  const seen = story ? knowsStory(opened, story) : false;
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
      {story && (
        <div className="mt-2 flex items-start gap-3 py-2.5">
          <span className={`w-4 shrink-0 text-lg font-bold leading-tight ${seen ? "text-muted" : "text-[var(--vote-up)]"}`}>
            {current + 1}
          </span>
          <span className="min-w-0 flex-1">
            <Link
              href={storyPath(story)}
              {...umamiEvent("hoje-em-5-open", { position: current + 1 })}
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
        </div>
      )}
      {stories.length > 1 && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="História anterior"
            disabled={current === 0}
            onClick={() => setPicked(current - 1)}
            className="flex size-8 items-center justify-center rounded-full border border-line font-bold hover:bg-surface disabled:opacity-40"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <ol className="flex items-center gap-1.5">
            {stories.map((item, index) => {
              const read = knowsStory(opened, item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-label={`Ir para a história ${index + 1} (${read ? "lida" : "por ler"})`}
                    aria-current={index === current ? "step" : undefined}
                    onClick={() => setPicked(index)}
                    className="flex size-6 items-center justify-center"
                    suppressHydrationWarning
                  >
                    <span
                      aria-hidden="true"
                      className={`block size-2.5 rounded-full border ${
                        read ? "border-[var(--stage-law)] bg-[var(--stage-law)]" : "border-muted"
                      } ${index === current ? "ring-2 ring-[var(--vote-up)] ring-offset-2 ring-offset-[var(--card-hover)]" : ""}`}
                    />
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            aria-label="História seguinte"
            disabled={current === stories.length - 1}
            onClick={() => setPicked(current + 1)}
            className="flex size-8 items-center justify-center rounded-full border border-line font-bold hover:bg-surface disabled:opacity-40"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </section>
  );
}

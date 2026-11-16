"use client";

import { useState, useSyncExternalStore } from "react";
import { voteIdea, type Idea, type IdeaStatus } from "@/lib/api/feedback";

const STATUS: Record<IdeaStatus, { label: string; color: string }> = {
  in_progress: { label: "Em desenvolvimento", color: "var(--link)" },
  planned: { label: "Planeado", color: "var(--muted)" },
  reviewing: { label: "Em análise", color: "var(--muted)" },
  done: { label: "Feito", color: "var(--stage-approved)" },
};

// Which ideas this reader voted for, kept on the device. It may be blocked: then the buttons simply stay open.
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
const remember = (id: string) => {
  try {
    const ids = new Set(readVoted().split(",").filter(Boolean)).add(id);
    window.localStorage.setItem(KEY, [...ids].join(","));
  } catch {
    // Not remembered; the API still counts one vote per reader.
  }
  window.dispatchEvent(new Event(EVENT));
};

/** The most requested ideas, with a vote each. */
export function IdeaVotes({ ideas }: { ideas: Idea[] }) {
  const stored = useSyncExternalStore(subscribe, readVoted, () => "");
  const voted = new Set(stored.split(",").filter(Boolean));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const top = Math.max(...ideas.map((idea) => counts[idea.id] ?? idea.votes));

  async function vote(idea: Idea) {
    setFailed(null);
    setCounts((current) => ({ ...current, [idea.id]: (current[idea.id] ?? idea.votes) + 1 }));
    remember(idea.id);
    try {
      const votes = await voteIdea(idea.id);
      setCounts((current) => ({ ...current, [idea.id]: votes }));
    } catch {
      setCounts((current) => ({ ...current, [idea.id]: idea.votes }));
      setFailed(idea.id);
    }
  }

  return (
    <ul className="space-y-2">
      {ideas.map((idea) => {
        const votes = counts[idea.id] ?? idea.votes;
        const done = voted.has(idea.id) && failed !== idea.id;
        const status = STATUS[idea.status];
        return (
          <li key={idea.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${votes === top ? "border-ink" : "border-line"}`}>
            <button
              type="button"
              onClick={() => vote(idea)}
              disabled={done || idea.status === "done"}
              aria-pressed={done}
              aria-label={`${done ? "Votaste em" : "Votar em"} «${idea.title}», ${votes} votos`}
              className={`flex w-10 shrink-0 flex-col items-center rounded-lg py-1 font-mono text-xs font-bold ${
                done ? "text-[var(--stage-debate)]" : "hover:bg-surface"
              } disabled:cursor-default`}
            >
              <span aria-hidden="true">▲</span>
              {votes}
            </button>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-snug">{idea.title}</span>
              <span className="font-mono text-[11px]" style={{ color: status.color }}>
                {status.label}
              </span>
              {failed === idea.id && (
                <span role="alert" className="block text-xs text-danger">
                  O voto não chegou. Tenta mais tarde.
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

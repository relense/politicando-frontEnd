"use client";

import { useState } from "react";
import { useAccountGate, useReader } from "@/lib/account";
import { save, useExtras } from "@/lib/accountExtras";
import type { SaveKind } from "@/lib/api/engagement";

const WHAT: Record<SaveKind, string> = {
  editorial: "este artigo",
  comment: "este comentário",
  thread: "esta discussão",
  reply: "esta resposta",
};

/**
 * "Guardar" for what only an account keeps: blog posts, comments, forum threads and replies (news keep their own
 * button, which works without one). They show on /guardadas.
 */
export function SaveButton({ kind, id, compact = false }: { kind: SaveKind; id: number; compact?: boolean }) {
  const reader = useReader();
  const saved = useExtras().saved[kind].includes(id) && Boolean(reader);
  const gate = useAccountGate();
  const [failed, setFailed] = useState(false);

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-pressed={saved}
        onClick={(event) => {
          if (gate("save", event.currentTarget)) return;
          setFailed(false);
          save(kind, id, !saved).catch(() => setFailed(true));
        }}
        className={
          compact
            ? `inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 font-mono text-xs font-bold hover:bg-surface ${saved ? "text-[var(--accent)]" : "text-muted hover:text-ink"}`
            : `inline-flex h-[38px] items-center gap-1.5 rounded-full px-3.5 font-mono text-[12.5px] font-medium ${
                saved ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--button)] hover:bg-[var(--button-hover)]"
              }`
        }
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-4 stroke-current stroke-2 ${saved ? "fill-current" : "fill-none"}`}>
          <path d="M6 3h12v18l-6-4-6 4V3Z" strokeLinejoin="round" />
        </svg>
        {saved ? "Guardado" : "Guardar"}
        <span className="sr-only"> {WHAT[kind]}</span>
      </button>
      {failed && (
        <span role="alert" className="mt-1 font-mono text-[11px] text-muted">
          Não foi possível. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

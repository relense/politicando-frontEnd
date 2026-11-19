"use client";

import { useState, useSyncExternalStore } from "react";
import { useAccountGate } from "@/lib/account";
import { ApiError, markPost } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { publishAnswer, useAnswer } from "@/lib/liveAnswers";
import { voteStore } from "./ArticleVote";
import { ImportanceDots } from "./ImportaButton";
import { track } from "@/lib/analytics";

const keyOf = (slug: string) => `post:${slug}`;
type Answer = { importa: number; mine: number };

/** An answer from outside the button (the mark finished after logging in). */
export function applyPostAnswer(slug: string, answer: Answer) {
  voteStore.remember(keyOf(slug), answer.mine);
  publishAnswer("post", slug, answer);
}

/**
 * "Importa" on a blog post: one mark, no down-vote, so nobody can bury a post (editorial-api.md "Importa"). Pressing
 * again takes the mark back.
 */
export function PostImporta({ slug, title, importa }: { slug: string; title: string; importa: number }) {
  const remembered = voteStore.parse(useSyncExternalStore(voteStore.subscribe, voteStore.read, () => "{}"))[keyOf(slug)] === 1;
  const [state, setState] = useState<{ importa: number; mine: boolean | null }>({ importa, mine: null });
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const gate = useAccountGate();
  useAnswer<Answer>("post", slug, (answer) => setState({ importa: answer.importa, mine: answer.mine === 1 }));
  const was = state.mine ?? remembered;
  const mine = pending ?? was;
  // A cached page may not count the reader's own mark yet.
  const base = state.mine === null ? Math.max(state.importa, remembered ? 1 : 0) : state.importa;
  const count = pending === null || pending === was ? base : Math.max(0, base + (pending ? 1 : -1));

  async function toggle(button: HTMLElement) {
    const next = !mine;
    if (next && gate("post", button, { kind: "post", slug })) return;
    setPending(next);
    setFailed(false);
    try {
      const answer = await markPost(slug, next ? 1 : 0);
      voteStore.remember(keyOf(slug), answer.mine);
      setState({ importa: answer.importa, mine: answer.mine === 1 });
      if (next) track("importa", { where: "blog", post: slug });
    } catch (error) {
      // Needs an account: the login note opens instead (components/account/AccountRuntime).
      if (!(error instanceof ApiError && error.code === "login_required")) setFailed(true);
    } finally {
      setPending(null);
    }
  }

  return (
    <span className="relative z-10 inline-flex flex-col">
      <button
        type="button"
        aria-pressed={mine}
        onClick={(event) => void toggle(event.currentTarget)}
        className={`inline-flex h-[38px] items-center gap-[7px] rounded-full pl-2.5 pr-3.5 font-mono text-[12.5px] font-medium ${
          mine ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--button)] hover:bg-[var(--button-hover)]"
        }`}
      >
        <ImportanceDots importance={mine ? 1 : 0.35} />
        <span>Importa</span> <span className={`tabular-nums ${mine ? "" : "text-muted"}`}>{formatNumber(count)}</span>
        <span className="sr-only"> leitores dizem que «{title}» importa</span>
      </button>
      {failed && (
        <span role="alert" className="mt-1 font-mono text-[11px] text-muted">
          Não contou. Tenta outra vez.
        </span>
      )}
    </span>
  );
}

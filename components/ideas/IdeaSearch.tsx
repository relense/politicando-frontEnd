"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { IdeaVote } from "@/components/forum/IdeaVote";
import { Highlight } from "./Highlight";
import { commentsLabel } from "@/lib/ideas";
import { DiscussingNow, IdeaStatusBadge } from "./IdeaBits";
import { ideaClosed, ideaPath } from "./IdeaRow";
import { useIdeaSearch } from "./useIdeaSearch";

const newIdeaPath = (title: string) => (title.trim() ? `/feedback/nova?titulo=${encodeURIComponent(title.trim())}` : "/feedback/nova");

/** «Tens uma ideia ou encontraste um problema?»: a search before a form, so a reader votes on an idea instead of repeating it. */
export function IdeaSearch() {
  const id = useId();
  const [text, setText] = useState("");
  const { query, enabled, ideas, failed } = useIdeaSearch(text);
  const create = (
    <Link
      href={newIdeaPath(text)}
      className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
    >
      Criar nova ideia <span aria-hidden="true">&nbsp;→</span>
    </Link>
  );

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-2xl border border-line p-4">
      <label id={`${id}-heading`} htmlFor={`${id}-input`} className="block font-bold">
        Tens uma ideia ou encontraste um problema?
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-ink">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 fill-none stroke-current stroke-2 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={`${id}-input`}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="ex.: votações do orçamento"
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          className="min-h-11 w-full min-w-0 bg-transparent text-ink placeholder:text-muted focus:outline-none focus-visible:outline-none"
        />
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Procuramos ideias parecidas enquanto escreves.
      </p>

      <div aria-live="polite">
        {enabled && ideas && ideas.length > 0 && (
          <>
            <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-widest text-[#8a6500] dark:text-[#f2c94c]">
              {ideas.length === 1 ? "1 ideia parecida" : `${ideas.length} ideias parecidas`} · vota em vez de repetir
            </p>
            <ul aria-label="Ideias parecidas" className="mt-2 flex flex-col gap-2">
              {ideas.map((idea) => (
                <li key={idea.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                  <IdeaVote id={idea.id} title={idea.title} score={idea.score ?? 0} closed={ideaClosed(idea)} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold leading-snug">
                      <Highlight text={idea.title} query={query} />
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
                      <IdeaStatusBadge status={idea.status} />
                      <span>{commentsLabel(idea.replyCount)}</span>
                      <DiscussingNow idea={idea} />
                    </p>
                  </div>
                  <Link
                    href={ideaPath(idea.id)}
                    className="hidden shrink-0 rounded-full border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface sm:inline-block"
                  >
                    Ver discussão <span aria-hidden="true">→</span>
                  </Link>
                  <Link href={ideaPath(idea.id)} aria-label={`Ver discussão: ${idea.title}`} className="font-mono text-lg sm:hidden">
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              Nenhuma é a tua?
              {create}
            </p>
          </>
        )}
        {enabled && ideas && ideas.length === 0 && (
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            Ainda ninguém propôs isto. Sê a primeira pessoa.
            {create}
          </p>
        )}
        {enabled && failed && !ideas && (
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            Não conseguimos procurar agora.
            {create}
          </p>
        )}
      </div>
      {!enabled && (
        <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          Escreve umas palavras: mostramos as ideias parecidas antes de criares uma nova.
          {create}
        </p>
      )}
    </section>
  );
}

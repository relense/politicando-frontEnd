"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { NameAvatar } from "@/components/Avatar";
import { IdeaVote } from "@/components/forum/IdeaVote";
import { createThread, forumErrorMessage, IDEAS_BOARD, THREAD_LIMITS } from "@/lib/api/forums";
import { useAccountGate, useReader } from "@/lib/account";
import { markFollowed } from "@/lib/accountExtras";
import { track } from "@/lib/analytics";
import { rememberPosterId } from "@/lib/forumSession";
import { ideaClosed, ideaPath } from "./IdeaRow";
import { useIdeaSearch } from "./useIdeaSearch";

/** What a reader without an account wrote, kept on this device while they log in (logging in leaves the page). */
const DRAFT = "politicando:rascunho-ideia";
type Draft = { title: string; body: string; area: string };
const readDraft = (): Draft | null => {
  try {
    const raw = window.localStorage.getItem(DRAFT);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
};
const writeDraft = (draft: Draft | null) => {
  try {
    if (draft && (draft.title.trim() || draft.body.trim())) window.localStorage.setItem(DRAFT, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT);
  } catch {
    // Not kept on this device.
  }
};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-muted focus:outline-none";
const label = "mb-1.5 block font-mono text-[11px] font-bold";

/** «Propor uma ideia»: the title (checked against the ideas already there), why it'd help, where on the site. Needs an account. */
export function NewIdeaForm({ areas, initialTitle }: { areas: readonly string[]; initialTitle: string }) {
  const id = useId();
  const router = useRouter();
  const reader = useReader();
  const gate = useAccountGate();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { enabled, ideas } = useIdeaSearch(title);

  // Back from logging in: the text they had written wins over the title in the address (the way back carries it again).
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restored once, from this device, after hydration
    setTitle((current) => draft.title || current);
    setBody((current) => draft.body || current);
    setArea((current) => draft.area || current);
  }, []);
  // Kept while there's no account, so the login round trip doesn't lose it.
  useEffect(() => {
    if (reader === null) writeDraft({ title, body, area });
  }, [reader, title, body, area]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < THREAD_LIMITS.title[0]) return setError("Escreve um título com pelo menos 3 caracteres.");
    if (!cleanBody) return setError("Diz-nos porque seria útil.");
    const button = event.currentTarget.querySelector<HTMLElement>("button[type=submit]");
    if (gate("propose", button)) return;
    setError(null);
    setSending(true);
    try {
      const created = await createThread(IDEAS_BOARD, {
        title: cleanTitle,
        body: cleanBody,
        nickname: "",
        articleId: null,
        initiativeId: null,
        captchaToken: null,
        area: area || null,
      });
      writeDraft(null);
      rememberPosterId(created.id, created.posterId);
      // Opening an idea follows it.
      markFollowed("thread", created.id);
      track("idea-created", { area: area || "none" });
      router.push(ideaPath(created.id));
    } catch (failure) {
      setError(forumErrorMessage(failure));
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Propor uma ideia">
      <div className="flex flex-col gap-4 rounded-2xl border border-line p-4">
        <div>
          <label htmlFor={`${id}-title`} className={label}>
            Título
          </label>
          <input
            id={`${id}-title`}
            value={title}
            maxLength={THREAD_LIMITS.title[1]}
            placeholder="ex.: Alertas quando o meu deputado vota"
            onChange={(event) => setTitle(event.target.value)}
            className={field}
          />
        </div>

        <div aria-live="polite">
          {enabled && ideas && ideas.length > 0 && (
            <section
              aria-label="Ideias parecidas"
              className="rounded-xl border border-[color-mix(in_srgb,#f2c94c_40%,transparent)] bg-[color-mix(in_srgb,#f2c94c_8%,transparent)] p-3"
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#8a6500] dark:text-[#f2c94c]">
                Antes de publicar · estas são parecidas?
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {ideas.map((idea) => (
                  <li key={idea.id} className="flex items-center justify-between gap-3">
                    <Link href={ideaPath(idea.id)} className="min-w-0 break-words text-sm font-bold underline">
                      {idea.title}
                    </Link>
                    <IdeaVote id={idea.id} title={idea.title} score={idea.score ?? 0} closed={ideaClosed(idea)} pill />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-body`} className={label}>
            Porque seria útil?
          </label>
          <textarea
            id={`${id}-body`}
            value={body}
            rows={5}
            maxLength={THREAD_LIMITS.body}
            placeholder="Conta como usarias isto. Os exemplos ajudam outros a votar."
            onChange={(event) => setBody(event.target.value)}
            className={`${field} resize-y`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-area`} className={label}>
              Em que parte do site? <span className="font-normal text-muted">· opcional</span>
            </label>
            <select id={`${id}-area`} value={area} onChange={(event) => setArea(event.target.value)} className={field}>
              <option value="">Escolhe…</option>
              {areas.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>Publicas como</p>
            {reader ? (
              <p className={`${field} flex items-center gap-2`}>
                <NameAvatar name={reader.username} size="sm" />
                <b className="truncate">{reader.username}</b>
              </p>
            ) : (
              <p className="text-sm text-muted">Precisas de uma conta. O teu texto fica guardado enquanto entras.</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-[#f3d27a] px-5 py-2.5 font-mono text-sm font-bold text-[#1f1b10] hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "A publicar…" : "Publicar ideia →"}
        </button>
        <span className="font-mono text-[11px] text-muted">Fica pública no quadro. Outros podem votar e comentar.</span>
      </div>
    </form>
  );
}

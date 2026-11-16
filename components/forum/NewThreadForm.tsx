"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { createThread, forumErrorMessage, THREAD_LIMITS } from "@/lib/api/forums";
import { rememberPosterId } from "@/lib/forumSession";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "../Captcha";

/** Sent when the captcha is switched off for testing. The API decides whether it is accepted. */
const CAPTCHA_OFF_TOKEN = "captcha-disabled";

type Props = {
  board: string;
  boardName: string;
  /** What the thread will be about, when the reader came from an article or an initiative. */
  link: { kind: "article" | "initiative"; id: number; title: string } | null;
};

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink placeholder:text-muted focus:border-ink focus:outline-none";

export function NewThreadForm({ board, boardName, link }: Props) {
  const id = useId();
  const router = useRouter();
  const captcha = useRef<CaptchaHandle>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attached, setAttached] = useState(link);
  const captchaOff = isCaptchaOff();

  if (!isCaptchaConfigured()) return <p className="text-muted">O fórum está temporariamente indisponível para novas publicações.</p>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < THREAD_LIMITS.title[0]) return setError("Escreve um título com pelo menos 3 caracteres.");
    if (!cleanBody) return setError("Escreve o texto da discussão.");
    const captchaToken = captchaOff ? CAPTCHA_OFF_TOKEN : token;
    if (!captchaToken) return setError("Confirma que não és um robô antes de publicar.");
    setError(null);
    setSending(true);
    try {
      const created = await createThread(board, {
        title: cleanTitle,
        body: cleanBody,
        nickname: nickname.trim(),
        articleId: attached?.kind === "article" ? attached.id : null,
        initiativeId: attached?.kind === "initiative" ? attached.id : null,
        captchaToken,
      });
      rememberPosterId(created.id, created.posterId);
      router.push(`/forum/${board}/${created.id}`);
    } catch (failure) {
      setError(forumErrorMessage(failure));
      setSending(false);
    } finally {
      // A token can only be used once, whether the request worked or not.
      captcha.current?.reset();
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <h2 id={`${id}-heading`} className="text-lg font-bold">
        Nova discussão em {boardName}
      </h2>
      {attached && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-surface p-3 text-sm">
          <p>
            <span className="font-mono text-xs text-muted">{attached.kind === "article" ? "Sobre a notícia" : "Sobre a iniciativa"}</span>
            <span className="block font-bold">{attached.title}</span>
          </p>
          <button type="button" onClick={() => setAttached(null)} className="shrink-0 font-mono text-xs text-link underline">
            Remover
          </button>
        </div>
      )}
      <div>
        <label htmlFor={`${id}-title`} className="mb-1 block font-mono text-xs font-bold">
          Título
        </label>
        <input
          id={`${id}-title`}
          value={title}
          maxLength={THREAD_LIMITS.title[1]}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`${id}-body`} className="mb-1 block font-mono text-xs font-bold">
          Texto
        </label>
        <textarea
          id={`${id}-body`}
          value={body}
          rows={5}
          maxLength={THREAD_LIMITS.body}
          aria-describedby={`${id}-count`}
          onChange={(event) => setBody(event.target.value)}
          className={`${inputClass} resize-y`}
        />
        <p id={`${id}-count`} className="mt-1 text-right font-mono text-xs text-muted">
          {body.length}/{THREAD_LIMITS.body}
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-nickname`} className="mb-1 block font-mono text-xs font-bold">
          Nome (opcional)
        </label>
        <input
          id={`${id}-nickname`}
          value={nickname}
          maxLength={THREAD_LIMITS.nickname}
          autoComplete="off"
          placeholder="Anónimo"
          aria-describedby={`${id}-nickname-hint`}
          onChange={(event) => setNickname(event.target.value)}
          className={`${inputClass} sm:max-w-xs`}
        />
        <p id={`${id}-nickname-hint`} className="mt-1 text-xs text-muted">
          Qualquer pessoa pode usar qualquer nome. O ID ao lado identifica quem escreve dentro desta discussão.
        </p>
      </div>
      {!captchaOff && <Captcha ref={captcha} onToken={setToken} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-ink px-5 py-2 font-mono text-sm font-bold text-paper hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "A publicar…" : "Publicar discussão"}
        </button>
      </div>
    </form>
  );
}

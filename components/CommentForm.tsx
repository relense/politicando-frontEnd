"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from "react";
import { ApiError, createComment, screenedMessage } from "@/lib/api/client";
import type { Comment, CommentStance, NewComment, CommentTarget } from "@/lib/types";
import { useLockedOut, useReader } from "@/lib/account";
import { readDraft, savePending, writeDraft } from "@/lib/pendingAction";
import { useReturnPath } from "./account/AccountMenu";
import { GOLD, OUTLINE } from "./account/ui";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "./Captcha";
import { markFollowed } from "@/lib/accountExtras";

const MAX_LENGTH = 500;
const MAX_USERNAME = 20;
/** Sent when the captcha is switched off for testing. The API decides whether it is accepted. */
const CAPTCHA_OFF_TOKEN = "captcha-disabled";

const ERROR_MESSAGES: Record<string, string> = {
  recaptcha_failed: "A verificação anti-robô falhou. O teu texto foi mantido; confirma novamente e publica.",
  recaptcha_unavailable: "Os comentários estão temporariamente indisponíveis. O teu texto foi mantido; tenta daqui a pouco.",
  rate_limited: "Estás a comentar depressa demais. O teu texto foi mantido; espera um minuto e tenta novamente.",
  invalid_parent: "O comentário a que estás a responder já não está disponível.",
  login_required: "Entra na tua conta para comentar. O teu texto foi mantido.",
};
const DEFAULT_ERROR = "Não foi possível publicar o comentário. O teu texto foi mantido; tenta novamente.";

export type CommentFormHandle = { insert: (text: string) => void };

type Props = {
  target: CommentTarget;
  parentId: number | null;
  initialText?: string;
  autoFocus?: boolean;
  onPosted?: (comment: Comment) => void;
  onCancel?: () => void;
  ref?: Ref<CommentFormHandle>;
  /** "Concordo / Discordo": on a story about a proposal. Optional for the commenter; we never guess it. */
  stances?: boolean;
};

export function CommentForm({ target, parentId, initialText = "", autoFocus, onPosted, onCancel, ref, stances = false }: Props) {
  const id = useId();
  const queryClient = useQueryClient();
  const queryKey = ["comments", target];
  const captcha = useRef<CaptchaHandle>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const back = useReturnPath();
  const lockedOut = useLockedOut("comments");
  const [username, setUsername] = useState("");
  // What a reader without an account wrote here before is kept on the device, and comes back.
  const [text, setText] = useState(() => initialText || (typeof window === "undefined" ? "" : readDraft(target, parentId)));
  const [stance, setStance] = useState<CommentStance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The captcha appears once someone starts writing, so it does not crowd an idle form.
  const [captchaShown, setCaptchaShown] = useState(Boolean(initialText.trim()));
  const reader = useReader();
  // With an account the API needs no captcha, and the name is the account's.
  const captchaOff = isCaptchaOff() || Boolean(reader);

  // Puts the cursor at the end, after any ">>123" the form opened with.
  useEffect(() => {
    if (!autoFocus || !textarea.current) return;
    const field = textarea.current;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [autoFocus]);

  useImperativeHandle(ref, () => ({
    insert: (addition) => {
      setText((current) => (current && !current.endsWith("\n") ? `${current}\n${addition}` : current + addition));
      setCaptchaShown(true);
      textarea.current?.focus();
    },
  }));

  const mutation = useMutation({
    mutationFn: (input: NewComment) => createComment(input),
    // The comment appears at once; the page never blanks while it is being sent.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const tempId = -Date.now();
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) => [
        ...current,
        {
          id: tempId,
          username: input.username || null,
          text: input.text,
          parentId: input.parentId,
          createdAt: new Date().toISOString(),
          stance: input.stance ?? null,
          pending: true,
        },
      ]);
      return { tempId };
    },
    onError: (failure, _input, context) => {
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) => current.filter((comment) => comment.id !== context?.tempId));
      setError(screenedMessage(failure) || (failure instanceof ApiError && failure.code && ERROR_MESSAGES[failure.code]) || DEFAULT_ERROR);
    },
    onSuccess: (created, _input, context) => {
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) =>
        current.map((comment) => (comment.id === context.tempId ? created : comment)),
      );
      setText("");
      setStance(null);
      writeDraft(target, parentId, "");
      // Commenting on a story follows it (backend docs/engagement-api.md).
      const story = reader && /^\/stories\/(\d+)$/.exec(target);
      if (story) markFollowed("story", Number(story[1]));
      onPosted?.(created);
    },
    // A token can only be used once, whether the request worked or not.
    onSettled: () => captcha.current?.reset(),
  });

  if (!reader && !lockedOut && !isCaptchaConfigured()) {
    return <p className="text-muted">Os comentários estão temporariamente indisponíveis.</p>;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return setError("Escreve um comentário antes de publicar.");
    const captchaToken = reader ? null : captchaOff ? CAPTCHA_OFF_TOKEN : token;
    if (!reader && !captchaToken) return setError("Confirma que não és um robô antes de publicar.");
    setError(null);
    mutation.mutate({
      target,
      parentId,
      username: reader?.username ?? username,
      text: trimmed,
      captchaToken,
      stance: stances ? stance : null,
    });
  }

  const label = parentId === null ? "Comentário" : "Resposta";

  /** Without an account: the comment is kept, and published as soon as they've logged in and come back. */
  function continueTo(path: "/entrar" | "/criar-conta") {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(parentId === null ? "Escreve o teu comentário primeiro." : "Escreve a tua resposta primeiro.");
      textarea.current?.focus();
      return;
    }
    writeDraft(target, parentId, text);
    savePending(back, { kind: "comment", target, parentId, text: trimmed, stance: stances ? stance : null });
    window.location.assign(back === "/" ? path : `${path}?depois=${encodeURIComponent(back)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3 focus-within:border-muted"
    >
      {stances && (
        <fieldset className="flex flex-wrap items-center gap-2 px-1">
          <legend className="sr-only">A tua posição (opcional)</legend>
          <span aria-hidden="true" className="font-mono text-xs text-muted">
            A tua posição:
          </span>
          {(
            [
              ["agree", "Concordo", "var(--favor)"],
              ["disagree", "Discordo", "var(--contra)"],
            ] as const
          ).map(([value, label, color]) => (
            <button
              key={value}
              type="button"
              aria-pressed={stance === value}
              onClick={() => setStance(stance === value ? null : value)}
              className="rounded-full border px-3 py-1 font-mono text-xs font-semibold"
              style={
                stance === value
                  ? { color, borderColor: color, background: `color-mix(in srgb, ${color} 14%, transparent)` }
                  : { borderColor: "var(--card-line)" }
              }
            >
              {label}
            </button>
          ))}
        </fieldset>
      )}
      <label htmlFor={`${id}-comment`} className="sr-only">
        {label}
      </label>
      <textarea
        id={`${id}-comment`}
        ref={textarea}
        value={text}
        rows={parentId === null ? 4 : 3}
        maxLength={MAX_LENGTH}
        placeholder={parentId === null ? "Escreve o teu comentário. Usa >>número para citar outro comentário." : "Escreve a tua resposta…"}
        aria-describedby={`${id}-count`}
        onChange={(event) => {
          setText(event.target.value);
          if (lockedOut) writeDraft(target, parentId, event.target.value);
          if (event.target.value.trim()) setCaptchaShown(true);
        }}
        className="w-full resize-y bg-transparent px-1 text-ink placeholder:text-muted focus:outline-none"
      />
      {captchaShown && !captchaOff && !lockedOut && <Captcha ref={captcha} onToken={setToken} />}
      {error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {error}
        </p>
      )}
      {lockedOut ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color-mix(in_srgb,#f2c94c_35%,var(--line))] bg-[color-mix(in_srgb,#f2c94c_8%,transparent)] p-3">
            <p className="min-w-0 flex-1 basis-56 text-sm">
              <b>Falta só entrar.</b>{" "}
              <span className="text-muted">
                {parentId === null
                  ? "O teu comentário fica guardado e é publicado assim que entrares."
                  : "A tua resposta fica guardada e é publicada assim que entrares."}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {onCancel && (
                <button type="button" onClick={onCancel} className={`${OUTLINE} min-h-10 border-transparent px-3 text-xs`}>
                  Cancelar
                </button>
              )}
              <button type="button" onClick={() => continueTo("/entrar")} className={`${OUTLINE} min-h-10 px-4 text-xs`}>
                Entrar
              </button>
              <button type="button" onClick={() => continueTo("/criar-conta")} className={`${GOLD} min-h-10 px-4 text-xs`}>
                Criar conta e publicar
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-1 font-mono text-[11px] text-muted">
            <span>{text.trim() ? "✓ Rascunho guardado neste dispositivo" : ""}</span>
            <span id={`${id}-count`}>
              {text.length} / {MAX_LENGTH}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {reader ? (
            <p className="min-w-0 flex-1 basis-40 px-1 font-mono text-xs text-muted">
              A publicar como <b className="text-ink">{reader.username}</b>
            </p>
          ) : (
            <>
              <label htmlFor={`${id}-username`} className="sr-only">
                Nome (opcional)
              </label>
              <input
                id={`${id}-username`}
                value={username}
                maxLength={MAX_USERNAME}
                autoComplete="off"
                placeholder="Nome (opcional): anon"
                onChange={(event) => setUsername(event.target.value.replace(/\s+/g, ""))}
                className="min-w-0 flex-1 basis-40 rounded-full border border-line bg-paper px-3 py-1.5 font-mono text-xs text-ink placeholder:text-muted"
              />
            </>
          )}
          <span id={`${id}-count`} className="font-mono text-xs text-muted">
            {text.length}/{MAX_LENGTH}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full px-4 py-1.5 font-mono text-sm font-bold text-muted hover:bg-surface hover:text-ink"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-full bg-ink px-4 py-1.5 font-mono text-sm font-bold text-paper hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending ? "A publicar…" : "Publicar"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

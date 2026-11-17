"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from "react";
import { ApiError, createComment } from "@/lib/api/client";
import type { Comment, CommentStance, NewComment, CommentTarget } from "@/lib/types";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "./Captcha";

const MAX_LENGTH = 500;
const MAX_USERNAME = 20;
/** Sent when the captcha is switched off for testing. The API decides whether it is accepted. */
const CAPTCHA_OFF_TOKEN = "captcha-disabled";

const ERROR_MESSAGES: Record<string, string> = {
  recaptcha_failed: "A verificação anti-robô falhou. O teu texto foi mantido; confirma novamente e publica.",
  recaptcha_unavailable: "Os comentários estão temporariamente indisponíveis. O teu texto foi mantido; tenta daqui a pouco.",
  rate_limited: "Estás a comentar depressa demais. O teu texto foi mantido; espera um minuto e tenta novamente.",
  invalid_parent: "O comentário a que estás a responder já não está disponível.",
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
  const [username, setUsername] = useState("");
  const [text, setText] = useState(initialText);
  const [stance, setStance] = useState<CommentStance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The captcha appears once someone starts writing, so it does not crowd an idle form.
  const [captchaShown, setCaptchaShown] = useState(Boolean(initialText.trim()));
  const captchaOff = isCaptchaOff();

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
      setError((failure instanceof ApiError && failure.code && ERROR_MESSAGES[failure.code]) || DEFAULT_ERROR);
    },
    onSuccess: (created, _input, context) => {
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) =>
        current.map((comment) => (comment.id === context.tempId ? created : comment)),
      );
      setText("");
      setStance(null);
      onPosted?.(created);
    },
    // A token can only be used once, whether the request worked or not.
    onSettled: () => captcha.current?.reset(),
  });

  if (!isCaptchaConfigured()) {
    return <p className="text-muted">Os comentários estão temporariamente indisponíveis.</p>;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return setError("Escreve um comentário antes de publicar.");
    const captchaToken = captchaOff ? CAPTCHA_OFF_TOKEN : token;
    if (!captchaToken) return setError("Confirma que não és um robô antes de publicar.");
    setError(null);
    mutation.mutate({ target, parentId, username, text: trimmed, captchaToken, stance: stances ? stance : null });
  }

  const label = parentId === null ? "Comentário" : "Resposta";

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
          if (event.target.value.trim()) setCaptchaShown(true);
        }}
        className="w-full resize-y bg-transparent px-1 text-ink placeholder:text-muted focus:outline-none"
      />
      {captchaShown && !captchaOff && <Captcha ref={captcha} onToken={setToken} />}
      {error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
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
    </form>
  );
}

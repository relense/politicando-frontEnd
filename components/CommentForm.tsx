"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type FormEvent } from "react";
import { ApiError, createComment } from "@/lib/api/client";
import type { Comment, NewComment } from "@/lib/types";
import { Captcha, isCaptchaConfigured, type CaptchaHandle } from "./Captcha";

const MAX_LENGTH = 500;
const MAX_USERNAME = 20;

const ERROR_MESSAGES: Record<string, string> = {
  recaptcha_failed: "A verificação anti-robô falhou. O teu texto foi mantido; confirma novamente e publica.",
  recaptcha_unavailable: "Os comentários estão temporariamente indisponíveis. O teu texto foi mantido; tenta daqui a pouco.",
  rate_limited: "Estás a comentar depressa demais. O teu texto foi mantido; espera um minuto e tenta novamente.",
  invalid_parent: "O comentário a que estás a responder já não está disponível.",
};
const DEFAULT_ERROR = "Não foi possível publicar o comentário. O teu texto foi mantido; tenta novamente.";

type Props = {
  articleId: number;
  parentId: number | null;
  onPosted?: (comment: Comment) => void;
};

export function CommentForm({ articleId, parentId, onPosted }: Props) {
  const id = useId();
  const queryClient = useQueryClient();
  const queryKey = ["comments", articleId];
  const captcha = useRef<CaptchaHandle>(null);
  const [username, setUsername] = useState("");
  const [text, setText] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: NewComment) => createComment(input),
    // The comment appears at once; the page never blanks while it is being sent.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const tempId = -Date.now();
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) => [
        ...current,
        { id: tempId, username: input.username || null, text: input.text, parentId: input.parentId, createdAt: new Date().toISOString(), pending: true },
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
    if (!token) return setError("Confirma que não és um robô antes de publicar.");
    setError(null);
    mutation.mutate({ articleId, parentId, username, text: trimmed, captchaToken: token });
  }

  const fieldClass = "w-full rounded border border-line bg-paper p-2 text-ink placeholder:text-muted";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 rounded border border-line bg-surface p-3">
      <div>
        <label htmlFor={`${id}-username`} className="mb-1 block font-mono text-xs text-muted">
          Nome (opcional)
        </label>
        <input
          id={`${id}-username`}
          value={username}
          maxLength={MAX_USERNAME}
          autoComplete="off"
          placeholder="anon"
          onChange={(event) => setUsername(event.target.value.replace(/\s+/g, ""))}
          className={`${fieldClass} font-mono text-sm`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-comment`} className="mb-1 block font-mono text-xs text-muted">
          {parentId === null ? "Comentário" : "Resposta"}
        </label>
        <textarea
          id={`${id}-comment`}
          value={text}
          rows={4}
          maxLength={MAX_LENGTH}
          aria-describedby={`${id}-count`}
          onChange={(event) => setText(event.target.value)}
          className={fieldClass}
        />
        <p id={`${id}-count`} className="text-right font-mono text-xs text-muted">
          {text.length}/{MAX_LENGTH}
        </p>
      </div>
      <Captcha ref={captcha} onToken={setToken} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded bg-ink px-4 py-2 font-mono text-sm font-bold text-paper hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? "A publicar…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}

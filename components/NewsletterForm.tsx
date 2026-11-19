"use client";

import { useMutation } from "@tanstack/react-query";
import { useId, useRef, useState, type FormEvent } from "react";
import { ApiError, subscribeNewsletter } from "@/lib/api/client";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "./Captcha";
import { track } from "@/lib/analytics";

/** Sent when the captcha is switched off for testing. The API decides whether it is accepted. */
const CAPTCHA_OFF_TOKEN = "captcha-disabled";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Esse endereço de email não parece válido.",
  recaptcha_failed: "A verificação anti-robô falhou. Confirma novamente e envia.",
  rate_limited: "Demasiadas tentativas. Espera um minuto e tenta novamente.",
  newsletter_unavailable: "A newsletter ainda não está a funcionar. Volta em breve.",
  mail_unavailable: "Não conseguimos enviar emails neste momento. Tenta daqui a pouco.",
  recaptcha_unavailable: "A inscrição está temporariamente indisponível. Tenta daqui a pouco.",
};
const DEFAULT_ERROR = "Não foi possível fazer a inscrição. Tenta novamente.";

/**
 * Sign-up with double opt-in. The answer is the same whether or not the address was already in, so the message
 * only says to check the inbox.
 */
/** `band`: the footer's strip, field and button on one line, the button in gold. */
export function NewsletterForm({ compact = false, band = false }: { compact?: boolean; band?: boolean }) {
  const id = useId();
  const captcha = useRef<CaptchaHandle>(null);
  const captchaOff = isCaptchaOff();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ address, captchaToken }: { address: string; captchaToken: string }) => subscribeNewsletter(address, captchaToken),
    onSuccess: () => track("newsletter-subscribe", { where: band ? "band" : compact ? "box" : "page" }),
    onError: (failure) => setError((failure instanceof ApiError && failure.code && ERROR_MESSAGES[failure.code]) || DEFAULT_ERROR),
    // A token can only be used once, whether the request worked or not.
    onSettled: () => captcha.current?.reset(),
  });

  if (!isCaptchaConfigured()) return <p className="text-sm text-muted">A newsletter ainda não está disponível.</p>;

  if (mutation.isSuccess) {
    return (
      <p role="status" className="rounded-xl bg-surface p-3 text-sm leading-relaxed">
        <strong>Verifica o teu email.</strong> Se este endereço ainda não estiver inscrito, enviámos uma ligação para confirmares a
        inscrição. Só começas a receber depois de confirmares.
      </p>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return setError(ERROR_MESSAGES.invalid_email!);
    const captchaToken = captchaOff ? CAPTCHA_OFF_TOKEN : token;
    if (!captchaToken) return setError("Confirma que não és um robô antes de enviar.");
    setError(null);
    mutation.mutate({ address, captchaToken });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className={compact ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
        <label htmlFor={`${id}-email`} className="sr-only">
          {band ? "Email para a newsletter semanal" : "Email"}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="o.teu@email.pt"
          className={`h-10 min-w-0 ${compact ? "w-full" : "flex-[1_1_14rem]"} rounded-full border border-line bg-paper px-4 text-sm placeholder:text-muted focus:border-ink focus:outline-none`}
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className={`h-10 shrink-0 rounded-full px-4 font-mono text-xs font-bold hover:opacity-90 disabled:opacity-60 ${
            band ? "bg-[#f2c94c] text-[#1b1d22]" : "bg-ink text-paper"
          }`}
        >
          {mutation.isPending ? "A enviar…" : "Quero receber"}
        </button>
      </div>
      {email.trim() && !captchaOff && <Captcha ref={captcha} onToken={setToken} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {/* The footer's strip says it above the field. */}
      {!band && (
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          Guardamos só o email. Podes cancelar em qualquer altura, com a ligação em cada envio.
        </p>
      )}
    </form>
  );
}

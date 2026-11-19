"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { adoptAccount, READER_KEY } from "@/lib/account";
import { accountErrorMessage, confirmEmail, emailProblem, forgotPassword, resetPassword } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "../Captcha";
import { GOLD, OUTLINE } from "./ui";

/*
 * The pages the account's emails link to (backend docs/accounts-api.md). Mail scanners open every link, so nothing
 * happens until the reader presses the button.
 */

const INPUT = "w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-sm aria-[invalid=true]:border-danger";
/** Sent when the captcha is switched off for testing. The API decides whether it is accepted. */
const CAPTCHA_OFF_TOKEN = "captcha-disabled";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-bare className="mx-auto max-w-md">
      <div className="rounded-2xl border border-line bg-[var(--card)] p-5 sm:p-6 max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-3 space-y-4">{children}</div>
      </div>
    </div>
  );
}

const expired = (error: unknown) => error instanceof ApiError && error.code === "invalid_token";

/** /conta/confirmar-email?token=…: works logged out too (the link may open on another device). */
export function ConfirmEmail({ token }: { token: string }) {
  const client = useQueryClient();
  const confirm = useMutation({
    mutationFn: () => confirmEmail(token),
    onSuccess: () => void client.invalidateQueries({ queryKey: READER_KEY }),
  });
  return (
    <Panel title="Confirma o teu email">
      {confirm.isSuccess ? (
        <>
          <p role="status" className="text-sm">
            {confirm.data.newsletter
              ? "Email confirmado e estás inscrito na newsletter. Já o podes usar para recuperar a palavra-passe."
              : "Email confirmado. Já o podes usar para recuperar a palavra-passe."}
          </p>
          <Link href="/" className={GOLD}>
            Ir para as notícias
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Carrega no botão para confirmares o email da tua conta no Politicando.</p>
          <button type="button" disabled={!token || confirm.isPending} onClick={() => confirm.mutate()} className={`${GOLD} w-full`}>
            {confirm.isPending ? "Um momento…" : "Confirmar"}
          </button>
          {(confirm.isError || !token) && (
            <p role="alert" className="text-sm text-danger">
              {!token || expired(confirm.error) ? (
                <>
                  Esta ligação já não é válida: expirou ou já foi usada. Podes{" "}
                  <Link href="/conta#email" className="underline">
                    pedir outro email nas definições da conta
                  </Link>
                  .
                </>
              ) : (
                accountErrorMessage(confirm.error)
              )}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

/** /conta/recuperar: "Esqueci-me da palavra-passe". The answer is the same whether or not the address is on an account. */
export function ForgotPassword() {
  const id = useId();
  const captcha = useRef<CaptchaHandle>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const captchaOff = isCaptchaOff();
  const send = useMutation({
    mutationFn: (input: { email: string; captchaToken: string }) => forgotPassword(input.email, input.captchaToken),
    onSettled: () => captcha.current?.reset(),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = email.trim();
    const wrong = clean ? emailProblem(clean) : "Escreve o email da tua conta.";
    const captchaToken = captchaOff ? CAPTCHA_OFF_TOKEN : token;
    setProblem(wrong ?? (captchaToken ? null : "Confirma que não és um robô."));
    if (!wrong && captchaToken) send.mutate({ email: clean, captchaToken });
  }

  if (!isCaptchaConfigured())
    return (
      <Panel title="Recuperar a conta">
        <p className="text-muted">As contas estão temporariamente indisponíveis.</p>
      </Panel>
    );
  return (
    <Panel title="Recuperar a conta">
      {send.isSuccess ? (
        <>
          <p role="status" className="text-sm">
            Se este email estiver confirmado numa conta, enviámos uma ligação. Abre-a na próxima hora para escolheres uma palavra-passe
            nova; o email diz também o nome da conta.
          </p>
          <Link href="/entrar" className={OUTLINE}>
            Voltar a entrar
          </Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm text-muted">
            Escreve o email da tua conta e enviamos uma ligação para escolheres uma palavra-passe nova. Só funciona com um email confirmado.
          </p>
          <div>
            <label htmlFor={`${id}-email`} className="mb-1.5 block font-mono text-xs font-bold">
              Email
            </label>
            <input
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={problem && !problem.includes("robô") ? true : undefined}
              className={INPUT}
            />
          </div>
          {!captchaOff && <Captcha ref={captcha} onToken={setToken} />}
          {(problem || send.isError) && (
            <p role="alert" className="text-sm text-danger">
              {problem ?? accountErrorMessage(send.error)}
            </p>
          )}
          <button type="submit" disabled={send.isPending} className={`${GOLD} w-full`}>
            {send.isPending ? "Um momento…" : "Enviar a ligação"}
          </button>
          <p className="font-mono text-[11px] leading-relaxed text-muted">
            Sem email confirmado na conta, não a conseguimos recuperar.{" "}
            <Link href="/entrar" className="underline hover:text-ink">
              Voltar a entrar
            </Link>
          </p>
        </form>
      )}
    </Panel>
  );
}

/** /conta/nova-palavra-passe?token=…: the new password; this browser is then logged in, every other session out. */
export function ResetPassword({ token }: { token: string }) {
  const id = useId();
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: (reader) => adoptAccount(client, reader),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const wrong = password.length < 8 ? "Pelo menos 8 caracteres." : password.length > 200 ? "Até 200 caracteres." : null;
    setProblem(wrong);
    if (!wrong) reset.mutate();
  }

  return (
    <Panel title="Nova palavra-passe">
      {reset.isSuccess ? (
        <>
          <p role="status" className="text-sm">
            Palavra-passe mudada. Já entraste como <b className="font-mono">{reset.data.username}</b>; as sessões noutros dispositivos foram
            terminadas.
          </p>
          <Link href="/" className={GOLD}>
            Ir para as notícias
          </Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor={`${id}-password`} className="mb-1.5 block font-mono text-xs font-bold">
              Nova palavra-passe
            </label>
            <div className="relative">
              <input
                id={`${id}-password`}
                type={shown ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Pelo menos 8 caracteres"
                maxLength={200}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `${id}-problem` : undefined}
                className={`${INPUT} pr-20`}
              />
              <button
                type="button"
                onClick={() => setShown(!shown)}
                aria-pressed={shown}
                className="absolute inset-y-1 right-1 rounded-lg px-3 font-mono text-[11px] font-bold text-muted hover:bg-surface hover:text-ink"
              >
                {shown ? "Esconder" : "Mostrar"}
                <span className="sr-only"> a palavra-passe</span>
              </button>
            </div>
            {problem && (
              <p id={`${id}-problem`} className="mt-1 text-xs text-danger">
                {problem}
              </p>
            )}
          </div>
          {(reset.isError || !token) && (
            <p role="alert" className="text-sm text-danger">
              {!token || expired(reset.error) ? (
                <>
                  Esta ligação já não é válida: expirou (dura uma hora) ou já foi usada. Podes{" "}
                  <Link href="/conta/recuperar" className="underline">
                    pedir outra
                  </Link>
                  .
                </>
              ) : (
                accountErrorMessage(reset.error)
              )}
            </p>
          )}
          <button type="submit" disabled={!token || reset.isPending} className={`${GOLD} w-full`}>
            {reset.isPending ? "Um momento…" : "Mudar a palavra-passe"}
          </button>
        </form>
      )}
    </Panel>
  );
}

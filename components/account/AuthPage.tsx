"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { adoptAccount, useReader } from "@/lib/account";
import { accountErrorMessage, logIn, register } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "../Captcha";

type Mode = "login" | "register";

/** Sent when the captcha is switched off for testing. The API decides whether it is accepted. */
const CAPTCHA_OFF_TOKEN = "captcha-disabled";

export const USERNAME_RULE = /^[A-Za-z0-9_]{3,20}$/;
const COMMON = ["password", "palavra-passe", "palavrapasse", "12345678", "123456789", "qwertyui", "politicando", "portugal"];

/** 0 to 4, roughly: length first, then a mix of kinds of characters; the obvious ones are 0 whatever their length. */
export function passwordStrength(password: string): number {
  if (password.length < 8) return 0;
  if (COMMON.some((word) => password.toLowerCase().includes(word))) return 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) => kind.test(password)).length;
  let score = 1;
  if (password.length >= 12) score++;
  if (kinds >= 2) score++;
  if (kinds >= 3 || password.length >= 16) score++;
  return Math.min(4, score);
}

const STRENGTH = [
  { label: "Curta demais.", hint: "Pelo menos 8 caracteres." },
  { label: "Fraca.", hint: "Junta mais caracteres, números ou símbolos." },
  { label: "Razoável.", hint: "Mais uns caracteres e fica forte." },
  { label: "Boa.", hint: "Uma frase longa é ainda melhor." },
  { label: "Forte.", hint: "" },
];

/** Logging in and creating an account, one page with two tabs (/entrar, /criar-conta). */
export function AuthPage({ mode, back }: { mode: Mode; back: string }) {
  const reader = useReader();
  const query = back === "/" ? "" : `?depois=${encodeURIComponent(back)}`;

  return (
    <div data-bare className="mx-auto max-w-5xl">
      <Link href={back} className="font-mono text-xs text-muted hover:text-ink hover:underline">
        ← Voltar {back === "/" ? "às notícias" : "atrás"}
      </Link>
      <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
        <Why className="hidden lg:block" />
        <div className="rounded-2xl border border-line bg-[var(--card)] p-5 sm:p-6 max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0">
          <nav aria-label="Conta" className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1">
            {(
              [
                ["login", "/entrar", "Entrar"],
                ["register", "/criar-conta", "Criar conta"],
              ] as const
            ).map(([value, href, label]) => (
              <Link
                key={value}
                href={`${href}${query}`}
                aria-current={mode === value ? "page" : undefined}
                className={`flex min-h-9 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                  mode === value ? "bg-ink text-paper" : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {reader ? (
            <div className="mt-6 space-y-3">
              <h1 className="text-2xl font-bold">Já entraste</h1>
              <p className="text-sm text-muted">
                Estás com a conta <b className="font-mono text-ink">{reader.username}</b>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={back} className={GOLD}>
                  Continuar
                </Link>
                <Link
                  href="/conta"
                  className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 font-mono text-xs font-bold"
                >
                  Definições da conta
                </Link>
              </div>
            </div>
          ) : (
            <AuthForm key={mode} mode={mode} back={back} />
          )}
        </div>
        <details className="border-t border-line pt-4 lg:hidden">
          <summary className="cursor-pointer font-mono text-xs font-bold">Porquê criar conta?</summary>
          <Why compact className="mt-4" />
        </details>
      </div>
    </div>
  );
}

const GOLD =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#f2c94c] px-5 font-mono text-sm font-bold text-[#1b1d22] hover:bg-[#f5d36a] disabled:opacity-60";

const BENEFITS = [
  { title: "Guarda notícias", text: "Lê mais tarde, em qualquer dispositivo.", icon: "M7 4h10v16l-5-3.5L7 20V4Z" },
  {
    title: "Esconde o que não queres ver",
    text: "As notícias que escondes ficam escondidas em todo o lado.",
    icon: "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm6 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0M4 4l16 16",
  },
  { title: "Hoje em 5, sincronizado", text: "Marca o que já leste no telemóvel e no computador.", icon: "m5 12 4.5 4.5L19 7" },
  { title: "Um nome nos debates", text: "Os teus comentários ficam juntos e com o teu nome público.", icon: "M4 5h16v11H8l-4 4V5Z" },
];

function Why({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={className}>
      {!compact && (
        <>
          <Hemicycle />
          <p className="mt-6 text-4xl font-bold leading-tight">A política, à tua maneira.</p>
          <p className="mt-3 text-muted">Com conta, o Politicando lembra-se do que te interessa.</p>
        </>
      )}
      <ul className={`${compact ? "" : "mt-6"} divide-y divide-line border-y border-line`}>
        {BENEFITS.map((benefit) => (
          <li key={benefit.title} className="flex gap-3 py-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-brand"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
                <path d={benefit.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <b className="block text-sm">{benefit.title}</b>
              <span className="block text-sm text-muted">{benefit.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex gap-2 rounded-xl border border-line p-3 font-mono text-[11px] leading-relaxed text-muted">
        <span aria-hidden="true" className="font-bold text-brand">
          i
        </span>
        Ler é sempre livre, sem conta. A conta é só um nome público e uma palavra-passe: não pedimos email nem o teu nome verdadeiro.
      </p>
    </div>
  );
}

/** Seats in a half circle, one lit: the site's mark, drawn in dots. */
function Hemicycle() {
  const rows = [
    { r: 70, n: 15 },
    { r: 56, n: 12 },
    { r: 42, n: 9 },
    { r: 28, n: 6 },
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 160 84" className="w-40 text-muted">
      {rows.flatMap(({ r, n }) =>
        Array.from({ length: n }, (_, index) => {
          const angle = Math.PI - (index / (n - 1)) * Math.PI;
          return (
            <circle
              key={`${r}-${index}`}
              cx={80 + r * Math.cos(angle)}
              cy={78 - r * Math.sin(angle)}
              r={2}
              fill="currentColor"
              opacity={0.55}
            />
          );
        }),
      )}
      <circle cx={80} cy={78} r={4.5} className="fill-brand" />
    </svg>
  );
}

function AuthForm({ mode, back }: { mode: Mode; back: string }) {
  const id = useId();
  const router = useRouter();
  const client = useQueryClient();
  const captcha = useRef<CaptchaHandle>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [terms, setTerms] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const register_ = mode === "register";
  const captchaOff = isCaptchaOff();

  const submit = useMutation({
    mutationFn: ({ name, captchaToken }: { name: string; captchaToken: string }) =>
      (register_ ? register : logIn)({ username: name, password, captchaToken }),
    onSuccess: async (reader) => {
      await adoptAccount(client, reader);
      router.push(back);
    },
    // A token can only be used once, whether the request worked or not.
    onSettled: () => captcha.current?.reset(),
  });

  const strength = passwordStrength(password);
  const nameProblem = !USERNAME_RULE.test(username.trim())
    ? "Entre 3 e 20 letras sem acentos, números ou _ (sem espaços)."
    : submit.error instanceof ApiError && submit.error.code === "username_taken" && submit.variables?.name === username.trim()
      ? "Esse nome já está a ser usado. Escolhe outro."
      : null;
  const passwordProblem = password.length < 8 ? "Pelo menos 8 caracteres." : password.length > 200 ? "Até 200 caracteres." : null;
  const problems = register_
    ? [nameProblem, passwordProblem, terms ? null : "terms"].filter(Boolean)
    : [username.trim() && password ? null : "empty"].filter(Boolean);

  const [captchaError, setCaptchaError] = useState(false);
  function handle(event: FormEvent) {
    event.preventDefault();
    setChecked(true);
    if (problems.length > 0) return;
    const captchaToken = captchaOff ? CAPTCHA_OFF_TOKEN : token;
    setCaptchaError(!captchaToken);
    if (!captchaToken) return;
    submit.mutate({ name: username.trim(), captchaToken });
  }

  if (!isCaptchaConfigured()) return <p className="mt-6 text-muted">As contas estão temporariamente indisponíveis.</p>;

  return (
    <form onSubmit={handle} noValidate aria-labelledby={`${id}-title`} className="mt-6 space-y-5">
      <div>
        <h1 id={`${id}-title`} className="text-2xl font-bold">
          {register_ ? "Cria a tua conta" : "Entra na tua conta"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {register_ ? "Grátis. Demora um minuto." : "Com o nome público e a palavra-passe da tua conta."}
        </p>
      </div>

      <Field
        id={`${id}-name`}
        label={register_ ? "Nome público" : "Nome"}
        hint={register_ ? "Aparece nos teus comentários. Pode ser um pseudónimo: não pedimos o teu nome verdadeiro." : undefined}
        error={checked && register_ ? nameProblem : null}
      >
        {(props) => (
          <input
            {...props}
            value={username}
            onChange={(event) => setUsername(event.target.value.replace(/\s+/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            placeholder={register_ ? "ex.: leitor_de_setubal" : undefined}
            className={INPUT}
          />
        )}
      </Field>

      <Field
        id={`${id}-password`}
        label="Palavra-passe"
        hint={register_ ? "Não pedimos email, por isso não há forma de a recuperar: guarda-a num sítio seguro." : undefined}
        error={checked && register_ ? passwordProblem : null}
        after={
          register_ && password ? (
            <div className="mt-2">
              <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1 rounded-full ${step <= strength ? (strength <= 1 ? "bg-danger" : strength === 2 ? "bg-[#f2c94c]" : "bg-[var(--vote-up)]") : "bg-line"}`}
                  />
                ))}
              </div>
              <p aria-live="polite" className="mt-1.5 font-mono text-[11px] text-muted">
                <b className="text-ink">{STRENGTH[strength]!.label}</b> {STRENGTH[strength]!.hint}
              </p>
            </div>
          ) : null
        }
      >
        {(props) => (
          <div className="relative">
            <input
              {...props}
              type={shown ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={register_ ? "new-password" : "current-password"}
              placeholder={register_ ? "Pelo menos 8 caracteres" : undefined}
              maxLength={200}
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
        )}
      </Field>

      {register_ && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            aria-invalid={checked && !terms ? true : undefined}
            aria-describedby={checked && !terms ? `${id}-terms-error` : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[#f2c94c]"
          />
          <span>
            Aceito os{" "}
            <Link href="/termos" className="underline">
              Termos de utilização
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline">
              Política de privacidade
            </Link>
            .
            {checked && !terms && (
              <span id={`${id}-terms-error`} className="mt-1 block text-xs text-danger">
                Para criar a conta, aceita os termos.
              </span>
            )}
          </span>
        </label>
      )}

      {!captchaOff && <Captcha ref={captcha} onToken={setToken} />}

      {(submit.error || (checked && captchaError) || (checked && !register_ && problems.length > 0)) && (
        <p role="alert" className="text-sm text-danger">
          {checked && !register_ && problems.length > 0
            ? "Escreve o nome e a palavra-passe."
            : captchaError
              ? "Confirma que não és um robô."
              : accountErrorMessage(submit.error)}
        </p>
      )}

      <button type="submit" disabled={submit.isPending} className={`${GOLD} w-full`}>
        {submit.isPending ? "Um momento…" : register_ ? "Criar conta" : "Entrar"}
      </button>
      {!register_ && (
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          Esqueceste a palavra-passe? Como não pedimos email, não a conseguimos recuperar. Podes{" "}
          <Link href={`/criar-conta${back === "/" ? "" : `?depois=${encodeURIComponent(back)}`}`} className="underline hover:text-ink">
            criar outra conta
          </Link>
          .
        </p>
      )}
    </form>
  );
}

const INPUT =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-sm placeholder:text-muted aria-[invalid=true]:border-danger";

function Field({
  id,
  label,
  hint,
  error,
  after,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  after?: ReactNode;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-mono text-xs font-bold">
        {label}
      </label>
      {children({ id, "aria-describedby": described, ...(error ? { "aria-invalid": true as const } : {}) })}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      {after}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

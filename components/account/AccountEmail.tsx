"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { READER_KEY, useReader } from "@/lib/account";
import { ApiError } from "@/lib/api/client";
import { accountErrorMessage, emailProblem, remindLater, removeEmail, setEmail, setNewsletter, type Reader } from "@/lib/api/account";
import { GOLD } from "./ui";
import { track } from "@/lib/analytics";

/*
 * The account's optional email (backend docs/accounts-api.md): it recovers a forgotten password once confirmed, and can
 * carry the weekly newsletter. Never shown to anyone else.
 */

const INPUT = "w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-sm aria-[invalid=true]:border-danger";
const QUIET =
  "inline-flex min-h-10 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface disabled:opacity-50";
export const ASK_TEXT = "Junta um email para não perderes a conta se te esqueceres da palavra-passe.";

/** Keeps the cached reader in step after a change, without asking the API again. */
function useUpdateReader() {
  const client = useQueryClient();
  return (change: Partial<Reader> | Reader) =>
    client.setQueryData<Reader | null>(READER_KEY, (reader) => (reader ? { ...reader, ...change } : reader));
}

const sentText = (email: string) => `Enviámos-te um email para ${email}. Abre a ligação que lá está para o confirmares.`;

/**
 * The email field and «Adicionar»; the newsletter box unticked, unless the reader came from the newsletter switch (then
 * ticked, and the field focused). Stays after sending, to say where the link went.
 */
function AddEmailForm({
  initial = "",
  submitLabel = "Adicionar",
  onSent,
  forNewsletter = false,
}: {
  initial?: string;
  submitLabel?: string;
  onSent?: () => void;
  forNewsletter?: boolean;
}) {
  const id = useId();
  const update = useUpdateReader();
  const field = useRef<HTMLInputElement>(null);
  const [email, setValue] = useState(initial);
  const [newsletter, setWants] = useState(forNewsletter);
  useEffect(() => {
    if (forNewsletter) field.current?.focus();
  }, [forNewsletter]);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (input: { email: string; newsletter: boolean }) => setEmail(input.email, input.newsletter || undefined),
    onSuccess: ({ user }, input) => {
      update(user);
      if (input.newsletter) track("newsletter-subscribe", { where: "add-email" });
      onSent?.();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = email.trim();
    const wrong = clean ? emailProblem(clean) : "Escreve o teu email.";
    setProblem(wrong);
    if (!wrong) save.mutate({ email: clean, newsletter });
  }

  if (save.isSuccess)
    return (
      <p role="status" className="text-sm">
        {sentText(save.variables.email)}
      </p>
    );
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email
        </label>
        <input
          ref={field}
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="email"
          placeholder="o.teu@email.pt"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          className={`${INPUT} min-w-0 flex-1 basis-56`}
        />
        <button type="submit" disabled={save.isPending} className={GOLD}>
          {save.isPending ? "Um momento…" : submitLabel}
        </button>
      </div>
      {problem && (
        <p id={`${id}-problem`} className="text-xs text-danger">
          {problem}
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={newsletter}
          onChange={(event) => setWants(event.target.checked)}
          className="size-4 accent-[#f2c94c]"
        />
        Quero receber a newsletter semanal
      </label>
      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {accountErrorMessage(save.error)}
        </p>
      )}
    </form>
  );
}

/**
 * "Junta um email…": in the profile on every visit while the account has none (no «Agora não» there), and in the feed
 * when the API says to ask (`askForEmail`), where «Agora não» puts it off for 30 days.
 */
export function EmailAsk({ where, forNewsletter = false }: { where: "profile" | "feed"; forNewsletter?: boolean }) {
  const id = useId();
  const update = useUpdateReader();
  const [dismissed, setDismissed] = useState(false);
  const later = useMutation({
    mutationFn: remindLater,
    onSuccess: () => {
      update({ askForEmail: false });
      setDismissed(true);
    },
  });
  if (dismissed) return null;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--brand) 45%, var(--line))",
        background: "color-mix(in srgb, var(--brand) 7%, var(--card, transparent))",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-brand"
          style={{ background: "color-mix(in srgb, var(--brand) 16%, transparent)" }}
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
            <path d="M3 6h18v12H3V6Zm0 0 9 7 9-7" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="font-bold">
            Protege a tua conta
          </h2>
          <p className="mt-0.5 text-sm text-muted">{ASK_TEXT} É privado: só tu o vês.</p>
        </div>
      </div>
      <div className="mt-3">
        <AddEmailForm forNewsletter={forNewsletter} />
      </div>
      {where === "feed" && (
        <button
          type="button"
          disabled={later.isPending}
          onClick={() => later.mutate()}
          className="mt-2 font-mono text-[11px] font-bold text-muted underline underline-offset-2 hover:text-ink"
        >
          Agora não
        </button>
      )}
    </section>
  );
}

/** In the feed, between the news: only for an account the API says to ask. */
export function EmailPrompt() {
  const reader = useReader();
  if (!reader?.askForEmail) return null;
  return <EmailAsk where="feed" />;
}

/** The profile: the prompt while there's no email, then the address, its state, and the newsletter. */
export function AccountEmail({ reader }: { reader: Reader }) {
  // Kept up after adding one, so the card can say where the link went; back when the email is removed.
  const [asking, setAsking] = useState(!reader.email);
  /** The newsletter switch without an email: the card again, its field focused and the newsletter ticked. */
  const [askedFromSwitch, setAskedFromSwitch] = useState(0);
  return (
    <>
      {asking && <EmailAsk key={askedFromSwitch} where="profile" forNewsletter={askedFromSwitch > 0} />}
      <section id="email" aria-labelledby="email-titulo" className="scroll-mt-20 border-t border-line pt-6">
        <h2 id="email-titulo" className="mb-3 text-xl font-bold">
          Email e newsletter
        </h2>
        <EmailDetails
          reader={reader}
          onRemoved={() => setAsking(true)}
          onNeedEmail={() => {
            setAsking(true);
            setAskedFromSwitch((count) => count + 1);
          }}
        />
      </section>
    </>
  );
}

function EmailDetails({ reader, onRemoved, onNeedEmail }: { reader: Reader; onRemoved: () => void; onNeedEmail: () => void }) {
  const update = useUpdateReader();
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const remove = useMutation({
    mutationFn: removeEmail,
    onSuccess: () => {
      update({ email: null, emailConfirmed: false });
      setRemoving(false);
      onRemoved();
    },
  });
  const resend = useMutation({ mutationFn: () => setEmail(reader.email ?? "") });

  return (
    <div className="space-y-5">
      {reader.email ? (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2">
            <b className="break-all font-mono text-sm">{reader.email}</b>
            {reader.emailConfirmed ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--favor)_14%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--favor)]">
                ✓ confirmado
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-[var(--brand)] px-2 py-0.5 font-mono text-[11px] font-bold text-brand">
                por confirmar
              </span>
            )}
          </p>
          {!reader.emailConfirmed && (
            <div className="rounded-xl border border-line p-3 text-sm">
              {resend.isSuccess ? (
                <p role="status">{sentText(reader.email)}</p>
              ) : (
                <>
                  <p className="text-muted">
                    Até o confirmares, não serve para recuperar a palavra-passe. Procura o nosso email (vê também o spam).
                  </p>
                  <button type="button" disabled={resend.isPending} onClick={() => resend.mutate()} className={`${QUIET} mt-2`}>
                    Reenviar a confirmação
                  </button>
                  {resend.isError && (
                    <p role="alert" className="mt-2 text-danger">
                      {accountErrorMessage(resend.error)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {changing ? (
            <AddEmailForm submitLabel="Mudar" onSent={() => setChanging(false)} />
          ) : removing ? (
            <div className="rounded-xl border border-danger/40 p-3 text-sm">
              <p>Sem email, uma palavra-passe esquecida é uma conta perdida. A newsletter, se a recebes, continua.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                  className={`${QUIET} border-danger text-danger`}
                >
                  Sim, remover
                </button>
                <button type="button" onClick={() => setRemoving(false)} className={QUIET}>
                  Cancelar
                </button>
              </div>
              {remove.isError && (
                <p role="alert" className="mt-2 text-danger">
                  {accountErrorMessage(remove.error)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setChanging(true)} className={QUIET}>
                Mudar o email
              </button>
              <button type="button" onClick={() => setRemoving(true)} className={QUIET}>
                Remover o email
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">A conta ainda não tem email.</p>
      )}
      <NewsletterSwitch reader={reader} onNeedEmail={onNeedEmail} />
    </div>
  );
}

/** The weekly newsletter for the account's email: pending until the email is confirmed; without one, the card asks for it. */
function NewsletterSwitch({ reader, onNeedEmail }: { reader: Reader; onNeedEmail: () => void }) {
  const id = useId();
  const update = useUpdateReader();
  const toggle = useMutation({
    mutationFn: (on: boolean) => setNewsletter(on),
    onSuccess: (newsletter, on) => {
      update({ newsletter });
      if (on) track("newsletter-subscribe", { where: "profile" });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "no_email") onNeedEmail();
    },
  });
  const needsEmail = toggle.error instanceof ApiError && toggle.error.code === "no_email";
  const on = reader.newsletter === "pending" || reader.newsletter === "confirmed";
  return (
    <div className="flex items-start gap-3 border-t border-line pt-4">
      <div className="min-w-0 flex-1">
        <p id={`${id}-label`} className="font-bold">
          Newsletter semanal
        </p>
        <p id={`${id}-hint`} className="text-sm text-muted">
          {!reader.email
            ? "Junta um email para a receberes."
            : reader.newsletter === "pending"
              ? "Confirma o teu email para começares a receber."
              : "O essencial da semana política, no teu email."}
        </p>
        {toggle.isError && !needsEmail && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {accountErrorMessage(toggle.error)}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!on)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[var(--favor)]" : "bg-line"}`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0.5 size-5 rounded-full bg-paper shadow transition-transform ${on ? "translate-x-[1.375rem]" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { answerNewsletterLink, ApiError } from "@/lib/api/client";
import { NewsletterForm } from "./NewsletterForm";

const TEXT = {
  confirm: {
    title: "Confirma a tua inscrição na newsletter",
    intro: "Carrega no botão para começares a receber a newsletter semanal.",
    button: "Confirmar",
    done: "Inscrição confirmada. Obrigado! A newsletter chega uma vez por semana.",
  },
  unsubscribe: {
    title: "Queres deixar de receber a newsletter?",
    intro: "Carrega no botão e apagamos o teu endereço. Podes voltar a inscrever-te quando quiseres.",
    button: "Cancelar inscrição",
    done: "Cancelaste a inscrição. Não vais receber mais emails.",
  },
};

const BUTTON =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-5 font-mono text-sm font-bold text-paper hover:opacity-90 disabled:opacity-60";

/**
 * /newsletter/confirmar and /newsletter/cancelar (backend docs/newsletter-api.md): mail scanners open every link, so
 * nothing happens until the reader presses the button.
 */
export function NewsletterLink({ action, token }: { action: "confirm" | "unsubscribe"; token: string }) {
  const text = TEXT[action];
  const answer = useMutation({ mutationFn: () => answerNewsletterLink(action, token) });
  const invalid = !token || (answer.error instanceof ApiError && answer.error.code === "invalid_token");
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-line p-5 sm:p-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Newsletter semanal</p>
        <h1 className="text-2xl font-bold leading-snug">{text.title}</h1>
        {answer.isSuccess ? (
          <div className="mt-3 space-y-3">
            <p role="status" className="leading-relaxed">
              {text.done}
            </p>
            <p className="font-mono text-xs">
              <Link href="/" className="font-bold hover:underline">
                Ir para as notícias <span aria-hidden="true">→</span>
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="leading-relaxed text-muted">{text.intro}</p>
            <button type="button" disabled={!token || answer.isPending} onClick={() => answer.mutate()} className={BUTTON}>
              {answer.isPending ? "Um momento…" : text.button}
            </button>
            {(answer.isError || !token) && (
              <p role="alert" className="text-sm text-danger">
                {invalid
                  ? action === "confirm"
                    ? "Esta ligação já não é válida: expirou (dura 7 dias) ou o endereço foi removido. Inscreve-te outra vez aqui em baixo."
                    : "Esta ligação já não é válida. Se continuares a receber emails, usa a ligação do email mais recente."
                  : "Não foi possível. Tenta daqui a pouco."}
              </p>
            )}
          </div>
        )}
      </div>
      {action === "confirm" && invalid && answer.isError && (
        <section aria-labelledby="inscrever-outra-vez" className="mt-4 rounded-2xl border border-line p-5">
          <h2 id="inscrever-outra-vez" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
            Inscrever-me outra vez
          </h2>
          <NewsletterForm />
        </section>
      )}
    </div>
  );
}

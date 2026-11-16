import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterForm } from "@/components/NewsletterForm";

type Props = { searchParams: Promise<{ estado?: string | string[] }> };

export const metadata: Metadata = {
  title: "Newsletter",
  description: "O resumo da política portuguesa no teu email: o que mudou nas leis, no Governo e no Parlamento.",
};

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

/** Where the links in the emails land, after the API has done the work. */
const STATES: Record<string, { title: string; text: string; form: boolean }> = {
  confirmado: { title: "Inscrição confirmada. Obrigado!", text: "Vais começar a receber a newsletter no teu email.", form: false },
  cancelado: { title: "Cancelaste a inscrição.", text: "Não vais receber mais emails. Apagámos o teu endereço.", form: false },
  invalido: {
    title: "Esta ligação já não é válida.",
    text: "Pode ter expirado (a confirmação dura 7 dias) ou já ter sido usada. Podes inscrever-te outra vez aqui em baixo.",
    form: true,
  },
};

export default async function NewsletterPage({ searchParams }: Props) {
  const { estado } = await searchParams;
  const state = typeof estado === "string" ? (STATES[estado] ?? null) : null;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Por email · grátis</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          A <span className={MARKER}>newsletter</span>
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          O que mudou nas leis, no Governo e no Parlamento, explicado em linguagem simples e com as fontes. Sem publicidade.
        </p>
      </header>

      {state && (
        <section role="status" aria-labelledby="estado" className="mb-6 max-w-xl rounded-2xl border border-line p-5">
          <h2 id="estado" className="text-xl font-bold leading-snug">
            {state.title}
          </h2>
          <p className="mt-1 leading-relaxed text-muted">{state.text}</p>
          {!state.form && (
            <p className="mt-3 font-mono text-xs">
              <Link href="/" className="font-bold hover:underline">
                Ir para as notícias <span aria-hidden="true">→</span>
              </Link>
            </p>
          )}
        </section>
      )}

      {(!state || state.form) && (
        <section aria-labelledby="inscrever" className="max-w-xl rounded-2xl border border-line p-5">
          <h2 id="inscrever" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
            Inscrever-me
          </h2>
          <NewsletterForm />
        </section>
      )}
    </div>
  );
}

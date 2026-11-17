import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CorrectionList } from "@/components/CorrectionList";
import { FeedbackForm } from "@/components/FeedbackForm";
import { IdeaCard } from "@/components/forum/IdeaCard";
import { getFeedbackSummary } from "@/lib/api/feedback";
import { getThreads, IDEAS_BOARD } from "@/lib/api/forums";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Feedback",
  description: "Encontraste um erro, tens uma ideia ou algo não funciona? Diz-nos. Cada correção fica registada em público, com a data.",
  alternates: { canonical: "/feedback" },
};

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

/** The site's sections, for "Em que página?". */
const PAGES = [
  "Notícias",
  "Blog",
  "Agenda",
  "Presidente",
  "Governo",
  "Parlamento",
  "Página de um deputado",
  "Partidos",
  "Iniciativas",
  "Eleições",
  "Autarquias",
  "Contratos",
  "História",
  "Legislaturas",
  "Percursos",
  "Outra",
];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const NEXT = [
  { title: "Lemos", text: "Uma pessoa da redação lê cada mensagem." },
  { title: "Confirmamos na fonte", text: "Erros só são corrigidos depois de confirmados numa fonte oficial." },
  { title: "Corrigimos em público", text: "A correção fica no registo, com data, e na própria página." },
];

export default async function FeedbackPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const [summary, ideas] = await Promise.all([
    getFeedbackSummary().catch(() => null),
    // The five most voted ideas; null while the board isn't there.
    getThreads(IDEAS_BOARD, { sort: "top", limit: 5 }).catch(() => null),
  ]);
  const page = PAGES.find((name) => name === first(params.pagina)) ?? null;
  const link = first(params.ligacao);

  return (
    <div data-wide className="pb-4">
      <header className="mb-8 max-w-2xl">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Feedback</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Diz-nos o que <span className={MARKER}>pensas</span>
        </h1>
        <p className="mt-2 leading-relaxed text-muted">
          Um número errado, uma ideia, uma página que não abre. Lemos tudo, e cada correção fica registada em público, com a data.
        </p>
      </header>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <FeedbackForm
            pages={PAGES}
            ideasOpen={ideas !== null}
            initialPage={page}
            initialUrl={link?.startsWith("http") || link?.startsWith("/") ? link : null}
          />
        </div>

        <aside
          aria-label="Depois de enviares"
          className="flex flex-col gap-4 no-scrollbar xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain xl:pb-2"
        >
          <section aria-labelledby="a-seguir" className="rounded-2xl border border-line p-4">
            <h2 id="a-seguir" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
              O que acontece a seguir
            </h2>
            <ol className="space-y-3">
              {NEXT.map((item, index) => (
                <li key={item.title} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-surface font-mono text-[11px] font-bold"
                  >
                    {index + 1}
                  </span>
                  <span>
                    <b className="block text-sm">{item.title}</b>
                    <span className="block text-xs leading-snug text-muted">{item.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            {summary && (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                {summary.responseDays !== null && (
                  <div className="flex flex-col-reverse">
                    <dt className="font-mono text-[11px] text-muted">tempo médio de resposta</dt>
                    <dd className="text-2xl font-bold">
                      {summary.responseDays < 1
                        ? "< 1 dia"
                        : `${Math.round(summary.responseDays)} ${Math.round(summary.responseDays) === 1 ? "dia" : "dias"}`}
                    </dd>
                  </div>
                )}
                <div className="flex flex-col-reverse">
                  <dt className="font-mono text-[11px] text-muted">correções este mês</dt>
                  <dd className="text-2xl font-bold text-[var(--stage-approved)]">{summary.correctionsThisMonth}</dd>
                </div>
              </dl>
            )}
          </section>

          {summary && summary.corrections.length > 0 && (
            <section aria-labelledby="registo-correcoes" className="rounded-2xl border border-line p-4">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h2 id="registo-correcoes" className="font-mono text-xs font-bold uppercase tracking-widest">
                  Registo de correções
                </h2>
                <Link href="/feedback/correcoes" className="font-mono text-[11px] underline hover:text-ink">
                  Ver tudo
                </Link>
              </div>
              <CorrectionList items={summary.corrections.slice(0, 4)} compact />
            </section>
          )}

          {ideas && (
            <section aria-labelledby="ideias" className="rounded-2xl border border-line p-4">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h2 id="ideias" className="font-mono text-xs font-bold uppercase tracking-widest">
                  Ideias mais votadas
                </h2>
                <Link href="/feedback/ideias" className="font-mono text-[11px] underline hover:text-ink">
                  Ver todas
                </Link>
              </div>
              <p className="mb-3 text-xs text-muted">Vota no que queres ver a seguir.</p>
              {ideas.items.length === 0 ? (
                <p className="text-sm text-muted">Ainda não há ideias. Propõe a primeira.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ideas.items.map((idea) => (
                    <li key={idea.id}>
                      <IdeaCard idea={idea} compact />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

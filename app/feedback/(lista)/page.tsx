import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { IdeaRow } from "@/components/ideas/IdeaRow";
import { IdeaSearch } from "@/components/ideas/IdeaSearch";
import { JoinBox } from "@/components/ideas/JoinBox";
import { ApiError } from "@/lib/api/client";
import { getFeedbackSummary } from "@/lib/api/feedback";
import { getThreads, IDEAS_BOARD } from "@/lib/api/forums";
import { boardPath, boardQuery, IDEA_FILTERS, IDEA_SORTS } from "@/lib/ideas";

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = boardQuery(await searchParams);
  const filtered = query.sort !== "top" || query.status !== null || query.page > 1;
  return {
    title: "Feedback: o que queres ver no Politicando?",
    description:
      "Vota nas ideias dos outros, discute-as ou propõe a tua. Encontraste um erro? Diz-nos, em privado. Cada correção fica registada.",
    alternates: { canonical: "/feedback" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

const HOW = [
  { title: "Lemos todas", text: "Uma pessoa da equipa lê cada ideia na semana em que chega." },
  { title: "Damos um estado", text: "Em análise, Planeada, A fazer, Feita ou Não vamos fazer, sempre com uma frase a explicar." },
  { title: "Avisamos quem votou", text: "Quem votou ou comentou recebe uma notificação quando o estado muda." },
];

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";
const heading = "font-mono text-[11px] font-bold uppercase tracking-widest";

/** The ideas board, the main page of Feedback: search first, then every idea; errors go to the private form. */
export default async function FeedbackPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  // Every page's «Diz-nos →» used to land here with the page filled in: that's the error form now.
  if (params.pagina || params.ligacao) {
    const query = new URLSearchParams({ tipo: "erro" });
    for (const key of ["pagina", "ligacao"] as const) {
      const value = params[key];
      if (typeof value === "string") query.set(key, value);
    }
    redirect(`/feedback/nova?${query}`);
  }
  const { sort, status, page } = boardQuery(params);
  const notThere = (error: unknown) => {
    // The board isn't there yet: the page says so, calmly, instead of failing.
    // Not served yet (404) or the API down: the page's calm state, never the error page.
    if (error instanceof ApiError) return null;
    throw error;
  };
  const [ideas, done, summary] = await Promise.all([
    getThreads(IDEAS_BOARD, { sort, status: status ?? undefined, page, limit: PAGE_SIZE }).catch(notThere),
    getThreads(IDEAS_BOARD, { sort: "top", status: "done", limit: 3 }).catch(() => null),
    getFeedbackSummary().catch(() => null),
  ]);
  const pages = ideas ? Math.max(1, Math.ceil(ideas.total / PAGE_SIZE)) : 1;
  const tab = (on: boolean) =>
    `inline-flex min-h-9 items-center border-b-2 px-1 font-mono text-xs font-bold ${on ? "border-[#f0c75e] text-ink" : "border-transparent text-muted hover:text-ink"}`;
  const chip = (on: boolean) =>
    `inline-flex min-h-8 items-center rounded-full border px-3 font-mono text-[11px] font-bold ${on ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;

  return (
    <div data-wide className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <header className="mb-6 max-w-2xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Feedback</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            O que queres ver no <span className={MARKER}>Politicando?</span>
          </h1>
          <p className="mt-2 leading-relaxed text-muted">
            Vota nas ideias dos outros, discute-as, ou propõe a tua. As mais votadas vão à frente e dizemos o que vamos fazer com cada uma.
          </p>
        </header>

        {ideas !== null && (
          <div className="mb-8">
            <IdeaSearch />
          </div>
        )}

        {ideas === null ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            O quadro de ideias abre em breve. Encontraste um erro?{" "}
            <Link href="/feedback/nova?tipo=erro" className="text-link underline">
              Diz-nos
            </Link>
            .
          </p>
        ) : (
          <section aria-labelledby="ideias">
            <h2 id="ideias" className="sr-only">
              Ideias
            </h2>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
              <nav aria-label="Ordenar ideias">
                <ul className="flex gap-4">
                  {IDEA_SORTS.map((item) => (
                    <li key={item.value}>
                      <Link
                        href={boardPath({ sort: item.value, status })}
                        aria-current={item.value === sort ? "page" : undefined}
                        className={tab(item.value === sort)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <nav aria-label="Filtrar por estado" className="-mb-px min-w-0 pb-2">
                <ul className="no-scrollbar flex gap-1.5 overflow-x-auto">
                  <li className="shrink-0">
                    <Link
                      href={boardPath({ sort, status: null })}
                      aria-current={status === null ? "page" : undefined}
                      className={chip(status === null)}
                    >
                      Todas
                    </Link>
                  </li>
                  {IDEA_FILTERS.map((item) => (
                    <li key={item.value} className="shrink-0">
                      <Link
                        href={boardPath({ sort, status: item.value })}
                        aria-current={status === item.value ? "page" : undefined}
                        className={chip(status === item.value)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {ideas.items.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
                {status
                  ? "Não há ideias com este estado."
                  : page > 1
                    ? "Não há ideias nesta página."
                    : "Ainda não há ideias. Propõe a primeira."}
              </p>
            ) : (
              <ul aria-label="Lista de ideias">
                {ideas.items.map((idea) => (
                  <li key={idea.id}>
                    <IdeaRow idea={idea} />
                  </li>
                ))}
              </ul>
            )}

            {pages > 1 && (
              <nav aria-label="Páginas" className="mt-6 flex items-center justify-between gap-3 font-mono text-sm">
                {page > 1 ? (
                  <Link href={boardPath({ sort, status, page: page - 1 })} rel="prev" className="text-link underline">
                    ← Anteriores
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-muted">
                  Página {page} de {pages}
                </span>
                {page < pages ? (
                  <Link
                    href={boardPath({ sort, status, page: page + 1 })}
                    rel="next"
                    className="rounded-full border border-line px-4 py-2 font-bold hover:bg-surface"
                  >
                    Ver mais ideias
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </section>
        )}
      </div>

      <aside aria-label="Sobre o feedback" className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <JoinBox />

        <section aria-labelledby="erro" className="rounded-2xl border border-line p-4">
          <h2 id="erro" className={`${heading} text-[var(--danger)]`}>
            Encontraste um erro?
          </h2>
          <p className="mt-2 text-sm">
            Um número, uma data ou um nome errado vai direto para a redação. É privado e podes enviar sem conta.
          </p>
          <Link
            href="/feedback/nova?tipo=erro"
            className="mt-3 inline-flex min-h-9 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
          >
            Reportar um erro <span aria-hidden="true">&nbsp;→</span>
          </Link>
          {summary && (
            <p className="mt-3 border-t border-line pt-3 font-mono text-[11px] text-muted">
              <span className="text-2xl font-bold text-[var(--stage-approved)]">{summary.correctionsThisMonth}</span>{" "}
              {summary.correctionsThisMonth === 1 ? "correção" : "correções"} este mês ·{" "}
              <Link href="/feedback/correcoes" className="underline hover:text-ink">
                ver registo
              </Link>
            </p>
          )}
        </section>

        <section aria-labelledby="como-decidimos" className="rounded-2xl border border-line p-4">
          <h2 id="como-decidimos" className={`${heading} text-muted`}>
            Como decidimos
          </h2>
          <ol className="mt-3 space-y-3">
            {HOW.map((item, index) => (
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
        </section>

        {done && done.items.length > 0 && (
          <section aria-labelledby="feito" className="rounded-2xl border border-line p-4">
            <h2 id="feito" className={`${heading} text-[var(--stage-approved)]`}>
              Feito a pedido vosso
            </h2>
            <ul className="mt-2 flex flex-col">
              {done.items.map((idea) => (
                <li key={idea.id} className="border-b border-line py-2 last:border-b-0">
                  <Link href={`/feedback/ideias/${idea.id}`} className="text-sm font-bold hover:underline">
                    {idea.title}
                  </Link>
                  <p className="font-mono text-[11px] text-muted">
                    Feita · {idea.score ?? 0} {idea.score === 1 ? "voto" : "votos"}
                  </p>
                </li>
              ))}
            </ul>
            <Link href={boardPath({ sort: "top", status: "done" })} className="mt-1 inline-block font-mono text-[11px] underline">
              Ver todas as feitas
            </Link>
          </section>
        )}
      </aside>
    </div>
  );
}

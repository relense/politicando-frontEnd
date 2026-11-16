import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { IdeaCard } from "@/components/forum/IdeaCard";
import { NewThreadForm } from "@/components/forum/NewThreadForm";
import { ApiError } from "@/lib/api/client";
import { getThreads, IDEA_STATUS_LABELS, IDEA_STATUSES, IDEAS_BOARD, type IdeaStatus, type ThreadSort } from "@/lib/api/forums";

const PAGE_SIZE = 25;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const SORTS: { value: ThreadSort; param: string; label: string }[] = [
  { value: "top", param: "votadas", label: "Mais votadas" },
  { value: "new", param: "novas", label: "Novas" },
  { value: "active", param: "ativas", label: "Ativas" },
];

/** Status filters, in Portuguese for the address bar. */
const STATUS_PARAMS: Record<IdeaStatus, string> = {
  reviewing: "em-analise",
  planned: "planeadas",
  in_progress: "em-desenvolvimento",
  done: "feitas",
  declined: "recusadas",
};

const sortOf = (value: unknown) => SORTS.find((sort) => sort.param === value) ?? SORTS[0]!;
const statusOf = (value: unknown) => IDEA_STATUSES.find((status) => STATUS_PARAMS[status] === value) ?? null;
const pageOf = (value: unknown) => (typeof value === "string" && /^[1-9]\d{0,3}$/.test(value) ? Number(value) : 1);

function pathOf({ sort, status, page = 1 }: { sort: string; status: IdeaStatus | null; page?: number }) {
  const query = new URLSearchParams();
  if (sort !== SORTS[0]!.param) query.set("ordem", sort);
  if (status) query.set("estado", STATUS_PARAMS[status]);
  if (page > 1) query.set("pagina", String(page));
  return query.size > 0 ? `/feedback/ideias?${query}` : "/feedback/ideias";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { ordem, estado, pagina } = await searchParams;
  const filtered = Boolean(statusOf(estado)) || pageOf(pagina) > 1 || sortOf(ordem) !== SORTS[0];
  return {
    title: "Ideias para o Politicando",
    description: "Propõe o que gostavas de ver no site e vota nas ideias dos outros. Dizemos em público o que vamos fazer.",
    alternates: { canonical: "/feedback/ideias" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function IdeasPage({ searchParams }: Props) {
  await connection();
  const { ordem, estado, pagina } = await searchParams;
  const sort = sortOf(ordem);
  const status = statusOf(estado);
  const page = pageOf(pagina);
  const ideas = await getThreads(IDEAS_BOARD, { sort: sort.value, status: status ?? undefined, page, limit: PAGE_SIZE }).catch(
    (error: unknown) => {
      // The board is not there yet: the page says so, calmly, instead of failing.
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    },
  );
  const pages = ideas ? Math.max(1, Math.ceil(ideas.total / PAGE_SIZE)) : 1;
  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full border px-3 font-mono text-xs font-bold ${active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;

  return (
    <div data-wide className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <nav aria-label="Caminho" className="mb-4 font-mono text-sm">
          <Link href="/feedback" className="text-link underline">
            Feedback
          </Link>
          <span aria-hidden="true" className="text-muted">
            {" "}
            ›{" "}
          </span>
          <span aria-current="page">Ideias</span>
        </nav>
        <header className="mb-6">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Ideias para o Politicando</h1>
          <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted">
            O que gostavas de ver no site? Propõe, vota nas ideias dos outros e discute-as. As mais votadas vão à frente, e dizemos aqui o
            que vamos fazer com cada uma.
          </p>
        </header>

        {ideas === null ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            O quadro de ideias abre em breve. Até lá, manda a tua ideia pelo{" "}
            <Link href="/feedback" className="text-link underline">
              formulário de feedback
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="Ordenar ideias">
                <ul className="flex flex-wrap gap-2">
                  {SORTS.map((item) => (
                    <li key={item.value}>
                      <Link
                        href={pathOf({ sort: item.param, status })}
                        aria-current={item === sort ? "page" : undefined}
                        className={chip(item === sort)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <a
                href="#nova"
                className="inline-flex min-h-9 items-center rounded-full bg-ink px-4 font-mono text-sm font-bold text-paper hover:opacity-90 xl:hidden"
              >
                Nova ideia
              </a>
            </div>
            <nav aria-label="Filtrar por estado" className="mb-6">
              <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <li className="shrink-0">
                  <Link
                    href={pathOf({ sort: sort.param, status: null })}
                    aria-current={status === null ? "page" : undefined}
                    className={chip(status === null)}
                  >
                    Todas
                  </Link>
                </li>
                {IDEA_STATUSES.map((item) => (
                  <li key={item} className="shrink-0">
                    <Link
                      href={pathOf({ sort: sort.param, status: item })}
                      aria-current={status === item ? "page" : undefined}
                      className={chip(status === item)}
                    >
                      {IDEA_STATUS_LABELS[item].label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {ideas.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
                {status
                  ? "Não há ideias com este estado."
                  : page > 1
                    ? "Não há ideias nesta página."
                    : "Ainda não há ideias. Propõe a primeira."}
              </p>
            ) : (
              <ul aria-label="Ideias" className="flex flex-col gap-3">
                {ideas.items.map((idea) => (
                  <li key={idea.id}>
                    <IdeaCard idea={idea} />
                  </li>
                ))}
              </ul>
            )}

            {pages > 1 && (
              <nav aria-label="Páginas" className="mt-8 flex items-center justify-between font-mono text-sm">
                {page > 1 ? (
                  <Link href={pathOf({ sort: sort.param, status, page: page - 1 })} rel="prev" className="text-link underline">
                    ← Anteriores
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-muted">
                  Página {page} de {pages}
                </span>
                {page < pages ? (
                  <Link href={pathOf({ sort: sort.param, status, page: page + 1 })} rel="next" className="text-link underline">
                    Seguintes →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </div>

      <aside id="nova" className="scroll-mt-24 xl:sticky xl:top-20 xl:self-start">
        {ideas !== null && (
          <>
            <NewThreadForm
              board={IDEAS_BOARD}
              boardName="Ideias"
              link={null}
              heading="Nova ideia"
              bodyLabel="Explica a ideia"
              titlePlaceholder="ex.: Alertas quando o meu deputado vota"
              bodyPlaceholder="O que gostavas de ver, e para quê?"
              submitLabel="Publicar ideia"
              threadBase="/feedback/ideias"
            />
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
              As ideias são públicas e qualquer pessoa as pode votar e comentar. Sem dados pessoais. Para um erro no site, usa o{" "}
              <Link href="/feedback" className="text-link underline">
                formulário de feedback
              </Link>
              : esse fica só entre ti e nós.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EditorialCard } from "@/components/EditorialCard";
import { ApiError, getEditorial } from "@/lib/api/client";
import { EDITORIAL_KINDS, KIND_PLURALS } from "@/lib/editorial";
import type { EditorialKind, EditorialPage } from "@/lib/types";

const PAGE_SIZE = 12;

type Props = { searchParams: Promise<{ tipo?: string | string[]; pagina?: string | string[] }> };

const kindOf = (value: unknown) => EDITORIAL_KINDS.find((kind) => kind === value) ?? null;
const pageOf = (value: unknown) => (typeof value === "string" && /^[1-9]\d{0,3}$/.test(value) ? Number(value) : 1);

function pathOf(kind: EditorialKind | null, page = 1) {
  const query = new URLSearchParams();
  if (kind) query.set("tipo", kind);
  if (page > 1) query.set("pagina", String(page));
  return query.size > 0 ? `/editorial?${query}` : "/editorial";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tipo, pagina } = await searchParams;
  const kind = kindOf(tipo);
  return {
    title: kind ? `${KIND_PLURALS[kind]} · Blog` : "Blog",
    description: "Artigos, opinião, entrevistas, podcasts e vídeos da redação do Politicando e de autores convidados.",
    alternates: { canonical: pathOf(kind, pageOf(pagina)) },
  };
}

/** Empty while the API doesn't serve posts yet, so the page can say so calmly. */
async function loadPage(kind: EditorialKind | null, page: number): Promise<EditorialPage> {
  try {
    return await getEditorial({ kind: kind ?? undefined, page, limit: PAGE_SIZE });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return { items: [], total: 0 };
    throw error;
  }
}

export default async function EditorialIndexPage({ searchParams }: Props) {
  await connection();
  const { tipo, pagina } = await searchParams;
  const kind = kindOf(tipo);
  const page = pageOf(pagina);
  const { items, total } = await loadPage(kind, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 font-mono text-xs font-bold ${active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Da redação</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Blog</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Artigos, opinião, entrevistas, podcasts e vídeos, escritos pela redação e por autores convidados. A opinião vincula apenas quem a
          assina.
        </p>
      </header>

      <nav aria-label="Tipo de publicação" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={pathOf(null)} aria-current={kind ? undefined : "page"} className={pill(!kind)}>
              Tudo
            </Link>
          </li>
          {EDITORIAL_KINDS.map((item) => (
            <li key={item}>
              <Link href={pathOf(item)} aria-current={kind === item ? "page" : undefined} className={pill(kind === item)}>
                {KIND_PLURALS[item]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {kind || page > 1 ? "Não há publicações aqui." : "Ainda não publicámos nada. Volta em breve."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((post) => (
            <li key={post.id}>
              <EditorialCard post={post} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-8 flex items-center justify-between font-mono text-sm">
          {page > 1 ? (
            <Link href={pathOf(kind, page - 1)} rel="prev" className="text-link underline">
              ← Mais recentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={pathOf(kind, page + 1)} rel="next" className="text-link underline">
              Mais antigas →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

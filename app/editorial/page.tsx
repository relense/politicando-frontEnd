import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterForm } from "@/components/NewsletterForm";
import { connection } from "next/server";
import { ArticleImage } from "@/components/ArticleImage";
import { EditorialCard } from "@/components/EditorialCard";
import { ApiError, getEditorial } from "@/lib/api/client";
import { EDITORIAL_KINDS, editorialPath, KIND_LABELS, KIND_PLURALS, readingLabel } from "@/lib/editorial";
import { formatLongDate } from "@/lib/format";
import { localPosts, withLocalPosts } from "@/lib/localPosts";
import type { EditorialKind, EditorialPage, EditorialPost } from "@/lib/types";

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

/** Each kind's colour, from the site's palette, and what it will be while there is none yet. */
const KINDS: Record<EditorialKind, { color: string; icon: string; soon: string }> = {
  article: { color: "var(--stage-submitted)", icon: "¶", soon: "Explicadores e guias da redação, com as fontes ligadas." },
  opinion: {
    color: "var(--stage-stopped)",
    icon: "“",
    soon: "Textos assinados por autores convidados, com posições claras e identificadas.",
  },
  podcast: {
    color: "var(--stage-president)",
    icon: "●",
    soon: "Conversas para ouvir no caminho: a semana política explicada em meia hora.",
  },
  interview: {
    color: "var(--stage-law)",
    icon: "?",
    soon: "Perguntas a deputados, autarcas e especialistas, com as respostas por inteiro.",
  },
  video: { color: "var(--stage-approved)", icon: "▶", soon: "Explicadores curtos: como funciona uma votação, um veto ou uma eleição." },
};

/** Tags that name a section of the site link to it. */
const SECTIONS: Record<string, string> = {
  parlamento: "/parlamento",
  governo: "/governo",
  presidente: "/presidente",
  partidos: "/partidos",
  iniciativas: "/iniciativas",
  eleições: "/eleicoes",
  eleicoes: "/eleicoes",
  autarquias: "/sitios",
  contratos: "/contratos",
  história: "/historia",
};

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

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
async function loadPage(kind: EditorialKind | null, page: number, limit = PAGE_SIZE): Promise<EditorialPage> {
  try {
    return await getEditorial({ kind: kind ?? undefined, page, limit });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return { items: [], total: 0 };
    throw error;
  }
}

/** How many posts of each kind, ours included, for the filter. */
async function loadCounts(): Promise<Record<EditorialKind, number>> {
  const totals = await Promise.all(
    EDITORIAL_KINDS.map(async (kind) => (await loadPage(kind, 1, 1).catch(() => ({ total: 0 }))).total + localPosts({ kind }).length),
  );
  return Object.fromEntries(EDITORIAL_KINDS.map((kind, index) => [kind, totals[index]!])) as Record<EditorialKind, number>;
}

export default async function EditorialIndexPage({ searchParams }: Props) {
  await connection();
  const { tipo, pagina } = await searchParams;
  const kind = kindOf(tipo);
  const page = pageOf(pagina);
  const [fromApi, counts] = await Promise.all([loadPage(kind, page), loadCounts()]);
  const { items, total } = withLocalPosts(fromApi, { kind, number: page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const all = EDITORIAL_KINDS.reduce((sum, item) => sum + counts[item], 0);
  // The newest gets the large box on the first page; the rest follow as cards.
  const [lead, ...rest] = page === 1 ? items : [null, ...items];
  const soon = EDITORIAL_KINDS.filter((item) => counts[item] === 0);
  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold ${
      active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
    }`;
  const count = (value: number, active: boolean) => (
    <span className={`rounded-full px-1.5 font-normal ${active ? "bg-paper/20" : "bg-surface"}`}>{value}</span>
  );

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Da redação</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          <span className={MARKER}>Blog</span>
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Artigos, opinião, entrevistas, podcasts e vídeos, escritos pela redação e por autores convidados. A opinião vincula apenas quem a
          assina.
        </p>
      </header>

      <nav aria-label="Tipo de publicação" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={pathOf(null)} aria-current={kind ? undefined : "page"} className={pill(!kind)}>
              Tudo {count(all, !kind)}
            </Link>
          </li>
          {EDITORIAL_KINDS.map((item) => (
            <li key={item}>
              <Link href={pathOf(item)} aria-current={kind === item ? "page" : undefined} className={pill(kind === item)}>
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: KINDS[item].color }} />
                {KIND_PLURALS[item]} {count(counts[item], kind === item)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 && (kind || page > 1) && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {kind && counts[kind] === 0 ? <>Em breve. {KINDS[kind].soon}</> : "Não há publicações aqui."}
        </p>
      )}

      {lead && <Lead post={lead} />}

      {rest.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((post) => (
            <li key={post!.id}>
              <EditorialCard post={post!} />
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

      {/* Under "Tudo": the formats still to come, and how we write. */}
      {!kind && page === 1 && (
        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {soon.length > 0 && (
              <section aria-labelledby="a-caminho">
                <h2 id="a-caminho" className="border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
                  A caminho
                </h2>
                <p className="mb-4 mt-2 text-sm text-muted">Os formatos que vão chegar ao blog.</p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {soon.map((item) => (
                    <li key={item} className="rounded-2xl border border-line p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          aria-hidden="true"
                          className="flex size-8 items-center justify-center rounded-lg font-bold"
                          style={{ color: KINDS[item].color, backgroundColor: `color-mix(in srgb, ${KINDS[item].color} 16%, transparent)` }}
                        >
                          {KINDS[item].icon}
                        </span>
                        <span
                          className="rounded-full border border-dashed px-2 py-0.5 font-mono text-[11px]"
                          style={{ color: KINDS[item].color, borderColor: KINDS[item].color }}
                        >
                          Em breve
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold">{KIND_PLURALS[item]}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{KINDS[item].soon}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside aria-labelledby="como-escrevemos" className="self-start rounded-2xl border border-line p-4">
            <h2 id="como-escrevemos" className="font-mono text-xs font-bold uppercase tracking-widest">
              Como escrevemos
            </h2>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed">
              {[
                { color: KINDS.article.color, title: "Artigos e guias", text: "explicam; não tomam partido." },
                { color: KINDS.opinion.color, title: "Opinião", text: "vem sempre assinada e marcada como tal." },
                { color: KINDS.interview.color, title: "Fontes", text: "ligadas em cada artigo." },
              ].map((item) => (
                <li key={item.title} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>
                    <strong>{item.title}</strong> {item.text}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-4">
              <h2 id="newsletter" className="font-mono text-xs font-bold uppercase tracking-widest">
                Newsletter
              </h2>
              <p className="mb-3 mt-1 text-sm leading-relaxed text-muted">O que mudou na política, no teu email. Sem publicidade.</p>
              <NewsletterForm compact />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/** The newest post, large: the cover, or a drawing of the chamber when there is none, beside the title. */
function Lead({ post }: { post: EditorialPost }) {
  const href = editorialPath(post.slug);
  const { color } = KINDS[post.kind];
  const related = post.tags.filter((tag) => SECTIONS[tag.toLowerCase()]);
  const kindTag = post.tags.find((tag) => !SECTIONS[tag.toLowerCase()]);
  return (
    <article className="grid overflow-hidden rounded-2xl border border-line md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {post.coverImageUrl ? (
        <ArticleImage src={post.coverImageUrl} href={href} className="block min-h-56 bg-surface" imageClassName="size-full object-cover" />
      ) : (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative flex min-h-56 items-center justify-center bg-[repeating-linear-gradient(135deg,var(--surface)_0_1px,transparent_1px_14px)]"
        >
          <Chamber color={color} />
        </Link>
      )}
      <div className="p-5 sm:p-8">
        <p className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold"
            style={{ color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            {KIND_LABELS[post.kind]}
            {kindTag && <> · {kindTag[0]!.toUpperCase() + kindTag.slice(1)}</>}
          </span>
          <span className="text-muted">Mais recente</span>
        </p>
        <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
          <Link href={href} className="hover:underline">
            {post.title}
          </Link>
        </h2>
        {post.subtitle && <p className="mt-3 leading-relaxed text-muted">{post.subtitle}</p>}
        <p className="mt-3 font-mono text-xs text-muted">
          {post.authorName && <>{post.authorName} · </>}
          <time dateTime={post.publishedAt}>{formatLongDate(post.publishedAt)}</time>
          {readingLabel(post) && <> · {readingLabel(post)}</>}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href={href} className="rounded-lg bg-[var(--marker)] px-4 py-2 font-mono text-xs font-bold text-ink hover:opacity-90">
            {post.kind === "podcast" ? "Ouvir o episódio" : post.kind === "video" ? "Ver o vídeo" : "Ler o artigo"} →
          </Link>
          {related.length > 0 && (
            <>
              <span className="ml-2 font-mono text-xs text-muted">Relacionado:</span>
              {related.map((tag) => (
                <Link
                  key={tag}
                  href={SECTIONS[tag.toLowerCase()]!}
                  className="rounded-full border border-line px-2.5 py-1 font-mono text-xs hover:bg-surface"
                >
                  {tag[0]!.toUpperCase() + tag.slice(1)}
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** A small hemicycle of dots, the house's mark, for a post without a cover. */
function Chamber({ color }: { color: string }) {
  const rows = [
    { radius: 70, count: 13 },
    { radius: 52, count: 10 },
    { radius: 34, count: 7 },
  ];
  return (
    <svg viewBox="-90 -90 180 100" className="w-48" aria-hidden="true">
      {rows.flatMap(({ radius, count }) =>
        Array.from({ length: count }, (_, index) => {
          const angle = Math.PI - (index / (count - 1)) * Math.PI;
          return <circle key={`${radius}-${index}`} cx={radius * Math.cos(angle)} cy={-radius * Math.sin(angle)} r={5} fill={color} />;
        }),
      )}
      <circle cx={0} cy={-8} r={7} fill="var(--stage-debate)" />
    </svg>
  );
}

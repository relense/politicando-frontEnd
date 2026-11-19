import type { Metadata } from "next";
import { SidebarFooter } from "@/components/FollowUs";
import Link from "next/link";
import { PodcastBox } from "@/components/PodcastBox";
import { getLatestEpisode } from "@/lib/api/podcast";
import { getPodcast } from "@/lib/podcast";
import { Fragment } from "react";
import { SearchToggle } from "@/components/SearchToggle";
import { connection } from "next/server";
import { ArticleImage } from "@/components/ArticleImage";
import { PostImporta } from "@/components/PostImporta";
import { CommentIcon } from "@/components/icons";
import { NewsletterForm } from "@/components/NewsletterForm";
import { PartyLogo } from "@/components/PartyLogo";
import { ApiError, getEditorial, getParties } from "@/lib/api/client";
import { comingSoon, EDITORIAL_KINDS, editorialPath, KIND_LABELS, KIND_PLURALS, readingLabel } from "@/lib/editorial";
import { fold, formatDayHeading, formatTime, lisbonDay } from "@/lib/format";
import { localPosts } from "@/lib/localPosts";
import type { EditorialKind, EditorialPost, Party } from "@/lib/types";

const PAGE_SIZE = 20;
/** The blog is small: it is read whole (up to this many pages of 50), then searched and counted here. */
const MAX_PAGES = 4;
const POPULAR_DAYS = 7;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const kindOf = (value: unknown) => EDITORIAL_KINDS.find((kind) => kind === value) ?? null;
const pageOf = (value: unknown) => (typeof value === "string" && /^[1-9]\d{0,3}$/.test(value) ? Number(value) : 1);

type View = { kind: EditorialKind | null; tag: string | null; q: string; popular: boolean; page: number };

function pathOf(view: View, change: Partial<View> = {}) {
  const next = { ...view, page: 1, ...change };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.kind) query.set("tipo", next.kind);
  if (next.tag) query.set("tema", next.tag);
  if (next.popular) query.set("ordem", "lidos");
  if (next.page > 1) query.set("pagina", String(next.page));
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

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The time of this request, for "Hoje" and "Ontem". */
const requestTime = () => Date.now();

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const kind = kindOf(first(params.tipo));
  const filtered = Boolean(first(params.q) || first(params.tema) || first(params.ordem));
  return {
    title: kind ? `${KIND_PLURALS[kind]} · Blog` : "Blog",
    description: "Artigos, opinião, entrevistas, podcasts e vídeos da redação do Politicando e de autores convidados.",
    alternates: { canonical: kind ? `/editorial?tipo=${kind}` : "/editorial" },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Every published post, ours included, newest first; empty while the API serves none. */
async function loadAll(): Promise<EditorialPost[]> {
  const posts: EditorialPost[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await getEditorial({ page, limit: 50 });
      posts.push(...result.items);
      if (posts.length >= result.total || result.items.length === 0) break;
    }
  } catch (error) {
    if (!(error instanceof ApiError && (error.status === 404 || error.status === 400))) throw error;
  }
  const own = localPosts().filter((post) => !posts.some((item) => item.slug === post.slug));
  return [...posts, ...own].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** The most read in the last days, when the API counts reads; null until then. */
async function loadPopular(): Promise<EditorialPost[] | null> {
  try {
    const { items } = await getEditorial({ sort: "popular", days: POPULAR_DAYS, limit: 50 });
    // The API that counts reads sends a count with each; an older one ignores the sort, so the box stays hidden.
    return items.length > 0 && items.every((post) => typeof (post.recentViews ?? post.views) === "number") ? items : null;
  } catch {
    return null;
  }
}

export default async function EditorialIndexPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const [all, popular, parties, episode] = await Promise.all([
    loadAll(),
    loadPopular(),
    getParties().catch((): Party[] => []),
    getLatestEpisode(),
  ]);
  const podcast = getPodcast();
  const tags = tagCounts(all, parties);
  const view: View = {
    kind: kindOf(first(params.tipo)),
    tag: tags.find(([tag]) => tag === first(params.tema))?.[0] ?? null,
    q: (first(params.q) ?? "").trim().slice(0, 100),
    popular: Boolean(popular) && first(params.ordem) === "lidos",
    page: pageOf(first(params.pagina)),
  };
  const words = fold(view.q).split(/\s+/).filter(Boolean);
  const matches = (post: EditorialPost, kind = view.kind) =>
    (!kind || post.kind === kind) &&
    (!view.tag || post.tags.includes(view.tag)) &&
    words.every((word) => fold(`${post.title} ${post.subtitle ?? ""} ${post.tags.join(" ")} ${post.authorName ?? ""}`).includes(word));
  const counts = Object.fromEntries(EDITORIAL_KINDS.map((kind) => [kind, all.filter((post) => matches(post, kind)).length])) as Record<
    EditorialKind,
    number
  >;
  // "Mais lidos" keeps the API's order (by reads in the period, `recentViews`), not all-time reads.
  const rank = new Map((popular ?? []).map((post, index) => [post.slug, index]));
  const shown = all.filter((post) => matches(post));
  if (view.popular) shown.sort((a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const onPage = shown.slice((view.page - 1) * PAGE_SIZE, view.page * PAGE_SIZE);
  const filtered = Boolean(view.kind || view.tag || view.q);
  /** After which post (by its slug) the newsletter comes on smaller screens; none on a short list. */
  const insertAt = onPage.length > 4 ? onPage[3]!.slug : null;
  const insert = (post: EditorialPost) =>
    post.slug === insertAt && (
      <li className="py-3 xl:hidden">
        <Newsletter id="newsletter-lista" />
      </li>
    );
  const soon = comingSoon(all, { podcastShow: Boolean(podcast) });
  /** Podcasts with no episode posts yet: the show itself, not an empty list or a "0". */
  const showOnly = (kind: EditorialKind) => kind === "podcast" && Boolean(podcast) && counts.podcast === 0;
  const podcastOnTop = view.kind === "podcast" && showOnly("podcast");
  const partyOf = (tag: string) => parties.find((party) => party.slug === tag || party.acronym.toLowerCase() === tag) ?? null;
  const now = requestTime();
  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold ${
      active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
    }`;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Da redação · artigos, opinião e podcasts</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          <span className={MARKER}>Blog</span>
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          Artigos, opinião, entrevistas, podcasts e vídeos, escritos pela redação e por autores convidados. A opinião vincula apenas quem a
          assina.
        </p>
      </header>

      <nav aria-label="Filtrar o blog" className="mb-4 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchToggle label="Procurar no blog" open={Boolean(view.q)}>
            <form role="search" action="/editorial" className="relative min-w-0">
              {view.kind && <input type="hidden" name="tipo" value={view.kind} />}
              {view.tag && <input type="hidden" name="tema" value={view.tag} />}
              {view.popular && <input type="hidden" name="ordem" value="lidos" />}
              <label>
                <span className="sr-only">Procurar no blog</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={view.q}
                  maxLength={100}
                  placeholder="Procurar no blog, ex.: «Orçamento»"
                  className="h-10 w-full rounded-full border border-line bg-paper pl-10 pr-4 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
                />
              </label>
              <button
                type="submit"
                aria-label="Procurar"
                className="absolute left-1 top-1 flex size-8 items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
                  <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </form>
          </SearchToggle>
          {tags.length > 0 && (
            <details className="group relative">
              <summary
                className={`flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border px-3 font-mono text-xs font-bold sm:px-4 [&::-webkit-details-marker]:hidden ${
                  view.tag ? "border-ink" : "border-line hover:bg-surface"
                }`}
              >
                {view.tag ? capital(view.tag) : "Temas"}
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 fill-none stroke-current stroke-2 group-open:rotate-180">
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </summary>
              <ul
                aria-label="Temas"
                className="absolute left-0 z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-2xl border border-line bg-paper p-2 shadow-xl sm:left-auto sm:right-0"
              >
                {view.tag && (
                  <li>
                    <Link
                      href={pathOf(view, { tag: null })}
                      className="block rounded-lg px-3 py-2 font-mono text-xs underline hover:bg-surface"
                    >
                      Todos os temas
                    </Link>
                  </li>
                )}
                {tags.map(([tag, count]) => (
                  <li key={tag}>
                    <Link
                      href={pathOf(view, { tag })}
                      aria-current={view.tag === tag ? "true" : undefined}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface ${view.tag === tag ? "font-bold" : ""}`}
                    >
                      {capital(tag)}
                      <span className="font-mono text-[11px] text-muted">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {popular && (
            <>
              {/* A small menu on a phone, where the row is short; two tabs from `sm` up. */}
              <details className="group relative ml-auto sm:hidden">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-line px-3 font-mono text-xs font-bold [&::-webkit-details-marker]:hidden">
                  <span className="sr-only">Ordem: </span>
                  {view.popular ? "Mais lidos" : "Recentes"}
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 fill-none stroke-current stroke-2 group-open:rotate-180">
                    <path d="M5 8l5 5 5-5" />
                  </svg>
                </summary>
                <ul aria-label="Ordem" className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-line bg-paper p-2 shadow-xl">
                  <li>
                    <Link
                      href={pathOf(view, { popular: false })}
                      aria-current={view.popular ? undefined : "true"}
                      className={`block rounded-lg px-3 py-2 text-sm hover:bg-surface ${view.popular ? "" : "font-bold"}`}
                    >
                      Recentes
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={pathOf(view, { popular: true })}
                      aria-current={view.popular ? "true" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm hover:bg-surface ${view.popular ? "font-bold" : ""}`}
                    >
                      Mais lidos · {POPULAR_DAYS} dias
                    </Link>
                  </li>
                </ul>
              </details>
              <div className="flex h-10 overflow-hidden rounded-full border border-line font-mono text-xs font-bold max-sm:hidden">
                <Link
                  href={pathOf(view, { popular: false })}
                  aria-current={view.popular ? undefined : "true"}
                  className={`flex items-center px-4 ${view.popular ? "hover:bg-surface" : "bg-ink text-paper"}`}
                >
                  Recentes
                </Link>
                <Link
                  href={pathOf(view, { popular: true })}
                  aria-current={view.popular ? "true" : undefined}
                  className={`flex items-center px-4 ${view.popular ? "bg-ink text-paper" : "hover:bg-surface"}`}
                >
                  Mais lidos
                </Link>
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-muted">Formato</span>
          <ul aria-label="Formato" className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
            <li>
              <Link href={pathOf(view, { kind: null })} aria-current={view.kind ? undefined : "true"} className={chip(!view.kind)}>
                Tudo <span className="font-normal opacity-70">{EDITORIAL_KINDS.reduce((sum, kind) => sum + counts[kind], 0)}</span>
              </Link>
            </li>
            {EDITORIAL_KINDS.map((kind) => (
              <li key={kind}>
                <Link
                  href={pathOf(view, { kind })}
                  aria-current={view.kind === kind ? "true" : undefined}
                  className={chip(view.kind === kind)}
                >
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: KINDS[kind].color }} />
                  {KIND_PLURALS[kind]} {!showOnly(kind) && <span className="font-normal opacity-70">{counts[kind]}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <p className="mb-4 font-mono text-xs text-muted" aria-live="polite">
            {filtered ? (
              <>
                <b className="text-ink">{shown.length === 1 ? "1 publicação" : `${shown.length} publicações`}</b>
                {view.q && ` com «${view.q}»`}
                {view.kind && ` · ${KIND_PLURALS[view.kind]}`}
                {view.tag && ` · ${capital(view.tag)}`}
                {" · "}
                <Link href="/editorial" className="underline hover:text-ink">
                  Ver tudo
                </Link>
              </>
            ) : view.popular ? (
              `Os mais lidos dos últimos ${POPULAR_DAYS} dias`
            ) : (
              "Tudo o que a redação publicou, mais recente primeiro"
            )}
          </p>

          {podcastOnTop && podcast ? (
            <PodcastBox podcast={podcast} episode={episode} headingId="podcast-blog" wide />
          ) : onPage.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              {view.kind && soon.includes(view.kind) ? <>Em breve. {KINDS[view.kind].soon}</> : "Não há publicações aqui."}
            </p>
          ) : view.popular ? (
            <ol className="flex flex-col divide-y divide-line">
              {onPage.map((post) => (
                <Fragment key={post.slug}>
                  <li>
                    <BlogRow post={post} partyOf={partyOf} />
                  </li>
                  {insert(post)}
                </Fragment>
              ))}
            </ol>
          ) : (
            byDay(onPage).map(({ day, posts }) => (
              <section key={day} aria-labelledby={`dia-${day}`} className="mb-2">
                <h2 id={`dia-${day}`} className="mb-1 mt-3 font-mono text-[11px] font-bold uppercase tracking-widest text-muted">
                  {formatDayHeading(posts[0]!.publishedAt, now)}
                </h2>
                <ul className="flex flex-col divide-y divide-line">
                  {posts.map((post) => (
                    <Fragment key={post.slug}>
                      <li>
                        <BlogRow post={post} partyOf={partyOf} />
                      </li>
                      {insert(post)}
                    </Fragment>
                  ))}
                </ul>
              </section>
            ))
          )}

          {pages > 1 && (
            <nav aria-label="Páginas" className="mt-6 flex items-center justify-between font-mono text-sm">
              {view.page > 1 ? (
                <Link href={pathOf(view, { page: view.page - 1 })} rel="prev" className="text-link underline">
                  ← Mais recentes
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted">
                Página {view.page} de {pages}
              </span>
              {view.page < pages ? (
                <Link href={pathOf(view, { page: view.page + 1 })} rel="next" className="text-link underline">
                  Mais antigas →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          {!filtered && view.page === 1 && soon.length > 0 && (
            <section aria-labelledby="em-breve" className="mt-10">
              <h2 id="em-breve" className="border-b-2 border-ink pb-2 font-mono text-xs font-bold uppercase tracking-widest">
                Em breve no blog
              </h2>
              <ul className="divide-y divide-line border-b border-line">
                {soon.map((kind) => (
                  <li key={kind} className="flex items-center gap-4 py-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg font-bold"
                      style={{ color: KINDS[kind].color, backgroundColor: `color-mix(in srgb, ${KINDS[kind].color} 16%, transparent)` }}
                    >
                      {KINDS[kind].icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-lg leading-tight">{KIND_PLURALS[kind]}</b>
                      <span className="block text-sm text-muted">{KINDS[kind].soon}</span>
                    </span>
                    <span
                      className="shrink-0 rounded-full border border-dashed px-2 py-0.5 font-mono text-[11px]"
                      style={{ color: KINDS[kind].color, borderColor: KINDS[kind].color }}
                    >
                      Em breve
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside
          aria-label="Mais do blog"
          className="flex flex-col gap-4 no-scrollbar xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain xl:pb-2"
        >
          {/* Between the posts on smaller screens (when there are enough of them), here on a wide one. */}
          <Newsletter id="newsletter" className={insertAt !== null ? "max-xl:hidden" : ""} />

          {popular && (
            <section aria-labelledby="mais-lidos" className="rounded-2xl border border-line p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 id="mais-lidos" className="font-mono text-xs font-bold uppercase tracking-widest">
                  Mais lidos
                </h2>
                <span className="font-mono text-[11px] text-muted">últimos {POPULAR_DAYS} dias</span>
              </div>
              <ol className="divide-y divide-line">
                {popular.slice(0, 5).map((post, index) => (
                  <li key={post.slug} className="flex gap-3 py-2.5">
                    <span className="w-5 shrink-0 text-xl font-bold text-[var(--stage-debate)]">{index + 1}</span>
                    <span className="min-w-0">
                      <Link href={editorialPath(post.slug)} className="block font-bold leading-snug hover:underline">
                        {post.title}
                      </Link>
                      <span className="font-mono text-[11px] text-muted">
                        {KIND_LABELS[post.kind]}
                        {readingLabel(post) && ` · ${readingLabel(post)!.replace(" de leitura", "")}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="como-escrevemos" className="rounded-2xl border border-line p-4">
            <h2 id="como-escrevemos" className="font-mono text-xs font-bold uppercase tracking-widest">
              Como escrevemos
            </h2>
            <ul className="mt-2 divide-y divide-line text-sm leading-relaxed">
              <li className="flex gap-2 py-2.5">
                <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: KINDS.article.color }} />
                <span>
                  <b>Artigos e guias</b> explicam; não tomam partido.
                </span>
              </li>
              <li className="flex gap-2 py-2.5">
                <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: KINDS.opinion.color }} />
                <span>
                  <b>Opinião</b> vem sempre assinada e marcada como tal.
                </span>
              </li>
              <li className="flex gap-2 py-2.5">
                <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: KINDS.interview.color }} />
                <span>
                  <b>Fontes</b> ligadas em cada artigo, e as{" "}
                  <Link href="/feedback/correcoes" className="underline hover:text-link">
                    correções ficam registadas
                  </Link>
                  .
                </span>
              </li>
            </ul>
          </section>
          <SidebarFooter />
        </aside>
      </div>

      {/* The podcast, at the end of the blog: the newest episode, ready to play here or in Spotify. */}
      {podcast && !podcastOnTop && <PodcastBox podcast={podcast} episode={episode} headingId="podcast-blog" className="mt-12" wide />}
    </div>
  );
}

/** Topics in use, most used first; party names are shown as parties on the posts, not offered as topics. */
function tagCounts(posts: EditorialPost[], parties: Party[]): [string, number][] {
  const isParty = (tag: string) => parties.some((party) => party.slug === tag || party.acronym.toLowerCase() === tag);
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of post.tags) if (!isParty(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"));
}

/** The newsletter box: in the column on a wide screen, between the posts otherwise. */
function Newsletter({ id, className = "" }: { id: string; className?: string }) {
  return (
    <section
      aria-labelledby={id}
      className={`rounded-2xl border border-[color-mix(in_srgb,var(--marker)_70%,var(--line))] bg-[color-mix(in_srgb,var(--marker)_18%,transparent)] p-4 ${className}`}
    >
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--stage-debate)]">Newsletter</p>
      <h2 id={id} className="mt-1 text-2xl font-bold leading-tight">
        Recebe os novos artigos no email
      </h2>
      <p className="mb-3 mt-2 text-sm leading-relaxed">Um email quando sai algo novo. Sem spam, cancelas quando quiseres.</p>
      <NewsletterForm compact />
    </section>
  );
}

function byDay(posts: EditorialPost[]): { day: string; posts: EditorialPost[] }[] {
  const days = new Map<string, EditorialPost[]>();
  for (const post of posts) {
    const day = lisbonDay(post.publishedAt) ?? post.publishedAt.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), post]);
  }
  return [...days].map(([day, list]) => ({ day, posts: list }));
}

/**
 * One post in the list, like a news card: kind, byline and time, title, subtitle, parties or topics, then votes and
 * comments when the API counts them. The cover sits beside on wider screens and under the title on a phone.
 */
function BlogRow({ post, partyOf }: { post: EditorialPost; partyOf: (tag: string) => Party | null }) {
  const href = editorialPath(post.slug);
  const { color } = KINDS[post.kind];
  const partyTags = post.tags.flatMap((tag) => {
    const party = partyOf(tag);
    return party ? [party] : [];
  });
  const topics = post.tags.filter((tag) => !partyOf(tag));
  const subtype = topics[0];
  const action =
    "inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 font-mono text-sm font-bold group-hover:bg-line/60 hover:!bg-line";
  return (
    <article className="group relative -mx-3 my-1 grid gap-x-6 gap-y-3 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--card-hover)] focus-within:bg-[var(--card-hover)] sm:-mx-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:px-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
      <div className="min-w-0">
        <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
          <span
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-bold"
            style={{ color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            {KIND_LABELS[post.kind]}
            {subtype && post.kind === "article" && <> · {capital(subtype)}</>}
          </span>
          {post.featured && <span className="rounded bg-[var(--marker)] px-1.5 py-0.5 font-bold text-ink">Em destaque</span>}
          {post.authorName && <b className="text-ink">{post.authorName}</b>}
          <span aria-hidden="true">·</span>
          <time dateTime={post.publishedAt}>{formatTime(post.publishedAt)}</time>
          {readingLabel(post) && (
            <>
              <span aria-hidden="true">·</span>
              <span>{readingLabel(post)}</span>
            </>
          )}
        </p>
        <h3 className="text-xl font-bold leading-snug sm:text-2xl">
          {/* The whole card opens the post; the links on it stay on top. */}
          <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl">
            {post.title}
          </Link>
        </h3>
        {post.subtitle && <p className="mt-1.5 leading-relaxed text-muted max-sm:line-clamp-3">{post.subtitle}</p>}
        {post.coverImageUrl && (
          <ArticleImage
            src={post.coverImageUrl}
            alt={post.title}
            href={href}
            className="relative z-10 mt-3 block aspect-video overflow-hidden rounded-xl bg-surface sm:hidden"
            imageClassName="size-full object-cover"
          />
        )}
        {(partyTags.length > 0 || topics.length > 0) && (
          <ul aria-label="Temas" className="relative z-10 mt-3 flex w-fit flex-wrap gap-1.5">
            {partyTags.map((party) => (
              <li key={party.slug}>
                <Link
                  href={`/partido/${party.slug}`}
                  className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-0.5 pr-2.5 font-mono text-xs font-bold hover:bg-surface"
                >
                  <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-white">
                    <PartyLogo slug={party.slug} acronym={party.acronym} size={18} />
                  </span>
                  {party.acronym}
                </Link>
              </li>
            ))}
            {partyTags.length === 0 &&
              topics.slice(0, 3).map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/editorial?tema=${encodeURIComponent(tag)}`}
                    className="block rounded-full border border-line px-3 py-1 font-mono text-xs hover:bg-surface"
                  >
                    {capital(tag)}
                  </Link>
                </li>
              ))}
          </ul>
        )}
        {(typeof post.importa === "number" || typeof post.commentCount === "number") && (
          <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
            {typeof post.importa === "number" && <PostImporta slug={post.slug} title={post.title} importa={post.importa} />}
            {typeof post.commentCount === "number" && (
              <Link href={`${href}#comentarios`} className={action}>
                <CommentIcon />
                <span>
                  <span>{post.commentCount}</span>{" "}
                  <span className="max-sm:sr-only">{post.commentCount === 1 ? "comentário" : "comentários"}</span>
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
      {post.coverImageUrl ? (
        <ArticleImage
          src={post.coverImageUrl}
          alt={post.title}
          href={href}
          className="relative z-10 hidden aspect-[16/10] self-start overflow-hidden rounded-xl bg-surface sm:block"
          imageClassName="size-full object-cover"
        />
      ) : (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden aspect-[16/10] items-center justify-center self-start rounded-xl border border-line bg-[repeating-linear-gradient(135deg,var(--surface)_0_1px,transparent_1px_12px)] sm:flex"
        >
          <Chamber color={color} />
        </Link>
      )}
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
    <svg viewBox="-90 -90 180 100" className="w-24" aria-hidden="true">
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

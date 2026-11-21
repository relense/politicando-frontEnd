import { CountRead } from "@/components/CountRead";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleActions } from "@/components/ArticleActions";
import { ArticleImage } from "@/components/ArticleImage";
import { ConsentEmbed } from "@/components/ConsentEmbed";
import { JumpLink } from "@/components/JumpLink";
import { PostImporta } from "@/components/PostImporta";
import { CommentSection } from "@/components/CommentSection";
import { ApiError, getComments, getEditorialPost } from "@/lib/api/client";
import { editorialPath, isAudio, KIND_LABELS, readingLabel } from "@/lib/editorial";
import { commentLinkLabel, decodeParam, excerpt, formatLongDate, readsLabel } from "@/lib/format";
import { localPost } from "@/lib/localPosts";
import { plainText, renderMarkdown, sectionsOf } from "@/lib/markdown";
import { clip, OG_BASE, pageTitle } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { postComments, type Comment, type EditorialDetail } from "@/lib/types";
import { SaveButton } from "@/components/account/SaveButton";

type Props = { params: Promise<{ slug: string }> };

async function loadPost(raw: string): Promise<EditorialDetail> {
  const slug = decodeParam(raw);
  if (slug === null) notFound();
  const own = localPost(slug);
  if (own) return own;
  try {
    return await getEditorialPost(slug);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

/**
 * Readers' comments, as on news. Posts written here in the code (lib/localPosts.ts) aren't in the API, so they have
 * none; and while the API doesn't answer, the box stays out rather than showing an error under the post.
 */
async function loadComments(post: EditorialDetail): Promise<Comment[] | null> {
  if (localPost(post.slug)) return null;
  return getComments(postComments(post.slug)).catch(() => null);
}

/** Never undefined: that would drop the site's description too, leaving the page with none. */
const describe = (post: EditorialDetail) => post.subtitle || excerpt(plainText(post.body), 160) || clip(post.title);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await loadPost((await params).slug);
  const description = describe(post);
  const path = editorialPath(post.slug);
  return {
    title: pageTitle(post.title),
    description,
    alternates: { canonical: path },
    authors: post.authorName ? [{ name: post.authorName }] : undefined,
    keywords: post.tags.length > 0 ? post.tags : undefined,
    openGraph: {
      ...OG_BASE,
      type: "article",
      title: post.title,
      description,
      url: path,
      publishedTime: post.publishedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: post.tags,
    },
  };
}

/** Structured data for search engines; "<" is escaped so the text can never close the script tag. */
function jsonLd(post: EditorialDetail) {
  const data = {
    "@context": "https://schema.org",
    "@type":
      post.kind === "opinion" ? "OpinionNewsArticle" : post.kind === "article" || post.kind === "interview" ? "NewsArticle" : "Article",
    headline: post.title,
    description: describe(post),
    datePublished: post.publishedAt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}${editorialPath(post.slug)}`,
    keywords: post.tags.length > 0 ? post.tags.join(", ") : undefined,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default async function EditorialPostPage({ params }: Props) {
  await connection();
  const post = await loadPost((await params).slug);
  const date = formatLongDate(post.publishedAt);
  const comments = await loadComments(post);
  const sections = post.media ? [] : sectionsOf(post.body);
  const long = sections.length >= 3;
  const author = post.authorName ?? "Redação Politicando";
  const reading = readingLabel(post);

  return (
    <article data-wide>
      <CountRead path={`/editorial/${encodeURIComponent(post.slug)}/view`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(post) }} />
      <nav aria-label="Caminho" className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        <Link href="/editorial" className="hover:text-ink hover:underline">
          Blog
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{KIND_LABELS[post.kind]}</span>
      </nav>

      <header className="max-w-4xl">
        <p className="flex flex-wrap gap-1.5 font-mono text-[11px] font-bold">
          <span className={`rounded-md px-1.5 py-0.5 ${post.kind === "opinion" ? "bg-ink text-paper" : "bg-surface"}`}>
            {KIND_LABELS[post.kind]}
          </span>
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md border border-line px-1.5 py-0.5 font-normal">
              {tag}
            </span>
          ))}
          {reading && <span className="rounded-md border border-line px-1.5 py-0.5 font-normal">{reading}</span>}
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
        {post.subtitle && <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">{post.subtitle}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-line py-3">
          <p className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-[#f0c75e] font-mono text-xs font-bold text-[#1a1a1a]"
            >
              {post.authorName ? initials(post.authorName) : "P"}
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">{author}</span>
              <span className="block font-mono text-[11px] text-muted">
                <time dateTime={post.publishedAt}>{date}</time>
                {reading && <> · {reading}</>}
                {typeof post.views === "number" && post.views > 0 && (
                  <>
                    {" · "}
                    <span className="whitespace-nowrap">{readsLabel(post.views)}</span>
                  </>
                )}
                {comments && (
                  <>
                    {" · "}
                    <a href="#comentarios" className="whitespace-nowrap hover:text-ink hover:underline">
                      {commentLinkLabel(comments.length)}
                    </a>
                  </>
                )}
              </span>
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {typeof post.importa === "number" && <PostImporta slug={post.slug} title={post.title} importa={post.importa} />}
            <SaveButton kind="editorial" id={post.id} />
            <ArticleActions title={post.title} />
          </div>
        </div>
        {post.kind === "opinion" && (
          <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-2 text-sm text-muted">
            Texto de opinião: vincula apenas {post.authorName ? `${post.authorName}` : "quem o assina"}, não o Politicando.
          </p>
        )}
      </header>

      {post.coverImageUrl && !post.media && (
        <ArticleImage
          src={post.coverImageUrl}
          alt={post.title}
          backdrop
          className="mt-6 block aspect-video max-w-4xl overflow-hidden rounded-2xl bg-surface"
          imageClassName="size-full object-contain"
        />
      )}
      {post.media && (
        <ConsentEmbed
          provider={post.media.provider}
          src={post.media.embedUrl}
          url={post.media.url}
          title={`${KIND_LABELS[post.kind]}: ${post.title}`}
          className={`mt-6 max-w-4xl overflow-hidden rounded-2xl bg-surface ${isAudio(post.media.provider) ? "h-[232px]" : "aspect-video"}`}
        />
      )}

      <div className={`mt-8 grid items-start gap-10 ${long ? "xl:grid-cols-[minmax(0,46rem)_16rem]" : ""}`}>
        <div className="min-w-0 max-w-[46rem]">
          {long && (
            <nav aria-label="Neste artigo" className="mb-8 rounded-2xl border border-line p-4 xl:hidden">
              <Contents sections={sections} />
            </nav>
          )}
          <div className={`post-body ${long ? "post-body--long" : ""}`}>{renderMarkdown(post.body)}</div>

          {post.tags.includes("parlamento") && (
            <Link
              href="/parlamento"
              className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--stage-debate)_45%,transparent)] bg-[color-mix(in_srgb,var(--stage-debate)_8%,transparent)] p-5 hover:bg-surface"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-bold">Queres ver quem são os 230?</span>
                <span className="block text-sm text-muted">
                  Todos os deputados no Parlamento, com o partido e o círculo por que foram eleitos.
                </span>
              </span>
              <span className="font-mono text-xs font-bold text-[var(--stage-debate)]">Abrir Parlamento →</span>
            </Link>
          )}

          {post.tags.length > 0 && (
            <ul aria-label="Temas" className="mt-10 flex flex-wrap gap-2 border-t border-line pt-4">
              {post.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-line px-3 py-1 font-mono text-xs">
                  #{tag}
                </li>
              ))}
            </ul>
          )}

          {comments && <CommentSection target={postComments(post.slug)} initialComments={comments} />}
        </div>

        {long && (
          <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar xl:block">
            <nav aria-label="Neste artigo" className="rounded-2xl border border-line p-4">
              <Contents sections={sections} />
            </nav>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <div className="flex flex-col-reverse rounded-xl border border-line p-3">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-muted">secções</dt>
                <dd className="text-xl font-bold">{sections.length}</dd>
              </div>
              {post.readingMinutes && (
                <div className="flex flex-col-reverse rounded-xl border border-line p-3">
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-muted">min. de leitura</dt>
                  <dd className="text-xl font-bold">{post.readingMinutes}</dd>
                </div>
              )}
            </dl>
          </aside>
        )}
      </div>
    </article>
  );
}

/** The post's sections, numbered as in the text, each a link to its heading. */
function Contents({ sections }: { sections: { id: string; title: string }[] }) {
  return (
    <>
      <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest">Neste artigo</p>
      <ol className="space-y-1">
        {sections.map((section, index) => (
          <li key={section.id}>
            <JumpLink to={section.id} className="flex gap-2.5 rounded-lg px-1.5 py-1 text-sm leading-snug hover:bg-surface">
              <span className="font-mono text-[11px] font-bold text-[var(--stage-debate)]">{String(index + 1).padStart(2, "0")}</span>
              <span>{section.title}</span>
            </JumpLink>
          </li>
        ))}
      </ol>
    </>
  );
}

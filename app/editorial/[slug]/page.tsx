import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleImage } from "@/components/ArticleImage";
import { ApiError, getEditorialPost } from "@/lib/api/client";
import { editorialPath, isAudio, KIND_LABELS } from "@/lib/editorial";
import { excerpt, formatLongDate } from "@/lib/format";
import { localPost } from "@/lib/localPosts";
import { plainText, renderMarkdown } from "@/lib/markdown";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { EditorialDetail } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

async function loadPost(slug: string): Promise<EditorialDetail> {
  const own = localPost(decodeURIComponent(slug));
  if (own) return own;
  try {
    return await getEditorialPost(decodeURIComponent(slug));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

const describe = (post: EditorialDetail) => post.subtitle ?? (excerpt(plainText(post.body), 160) || undefined);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await loadPost((await params).slug);
  const description = describe(post);
  const path = editorialPath(post.slug);
  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    authors: post.authorName ? [{ name: post.authorName }] : undefined,
    keywords: post.tags.length > 0 ? post.tags : undefined,
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: path,
      publishedTime: post.publishedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: post.tags,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
    twitter: { card: post.coverImageUrl ? "summary_large_image" : "summary", title: post.title, description },
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

export default async function EditorialPostPage({ params }: Props) {
  await connection();
  const post = await loadPost((await params).slug);
  const date = formatLongDate(post.publishedAt);

  return (
    <article className="max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(post) }} />
      <p className="mb-3 font-mono text-xs">
        <Link href="/editorial" className="text-muted underline hover:text-ink">
          Blog
        </Link>
        <span aria-hidden="true" className="text-muted">
          {" "}
          ›{" "}
        </span>
        <span
          className={
            post.kind === "opinion"
              ? "rounded bg-ink px-1.5 py-0.5 font-bold uppercase tracking-widest text-paper"
              : "font-bold uppercase tracking-widest"
          }
        >
          {KIND_LABELS[post.kind]}
        </span>
      </p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
      {post.subtitle && <p className="mt-3 text-lg leading-relaxed text-muted">{post.subtitle}</p>}
      <p className="mt-4 font-mono text-xs text-muted">
        {post.authorName && (
          <>
            Por <span className="font-bold text-ink">{post.authorName}</span> ·{" "}
          </>
        )}
        <time dateTime={post.publishedAt}>{date}</time>
      </p>
      {post.kind === "opinion" && (
        <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-2 text-sm text-muted">
          Texto de opinião: vincula apenas {post.authorName ? `${post.authorName}` : "quem o assina"}, não o Politicando.
        </p>
      )}

      {post.coverImageUrl && !post.media && (
        <ArticleImage src={post.coverImageUrl} className="mt-6 block overflow-hidden rounded-2xl bg-surface" imageClassName="w-full" />
      )}
      {post.media && (
        <div className={`mt-6 overflow-hidden rounded-2xl bg-surface ${isAudio(post.media.provider) ? "h-[232px]" : "aspect-video"}`}>
          <iframe
            src={post.media.embedUrl}
            title={`${KIND_LABELS[post.kind]}: ${post.title}`}
            className="size-full"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}

      <div className="post-body mt-8">{renderMarkdown(post.body)}</div>

      {post.tags.length > 0 && (
        <ul aria-label="Temas" className="mt-10 flex flex-wrap gap-2 border-t border-line pt-4">
          {post.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-line px-3 py-1 font-mono text-xs">
              #{tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

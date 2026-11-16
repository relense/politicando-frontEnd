import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleDetail } from "@/components/ArticleDetail";
import { CommentSection } from "@/components/CommentSection";
import { ArticleSidebar, type ArticleContext } from "@/components/ArticleSidebar";
import type { MoreAboutGroup } from "@/components/MoreAbout";
import { ApiError, getArticle, getComments, getFeedPage, getInitiative, getInitiatives } from "@/lib/api/client";
import { excerpt } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import type { Article } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

const MORE_COUNT = 3;

async function loadArticle(param: string) {
  if (!/^\d+$/.test(param)) notFound();
  try {
    return await getArticle(Number(param));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

/** Other news about each party the article mentions, up to three parties. A party that fails is left out. */
async function loadMore(article: Article): Promise<MoreAboutGroup[]> {
  const groups = await Promise.all(
    article.parties.slice(0, 3).map(async (party) => {
      try {
        const page = await getFeedPage({ party: party.slug, limit: 4 });
        return {
          slug: party.slug,
          acronym: party.acronym,
          articles: page.articles
            .filter((item) => item.id !== article.id)
            .slice(0, MORE_COUNT)
            .map(({ id, title, source, publishedAt }) => ({ id, title, source, publishedAt })),
        };
      } catch {
        return null;
      }
    }),
  );
  return groups.filter((group): group is MoreAboutGroup => group !== null);
}

/**
 * What is happening in Parliament on the article's subject: the topic of the first initiative it mentions and how
 * many initiatives share it. Without a topic, that initiative itself; without one, nothing.
 */
async function loadContext(article: Article): Promise<ArticleContext | null> {
  const first = article.initiatives[0];
  if (!first) return null;
  const fallback: ArticleContext = {
    kicker: "Contexto · No Parlamento",
    title: first.title,
    linkLabel: "Ver a iniciativa",
    href: `/iniciativas/${first.id}`,
  };
  try {
    const topic = (await getInitiative(first.id)).topics[0];
    if (!topic) return fallback;
    const total = (await getInitiatives({ topic: topic.slug, limit: 1 })).total;
    if (!total) return fallback;
    return {
      kicker: `Contexto · ${topic.label}`,
      title: `${total} ${total === 1 ? "iniciativa" : "iniciativas"} sobre ${topic.label.toLocaleLowerCase("pt")} no Parlamento`,
      linkLabel: "Ver o que está em discussão",
      href: `/iniciativas?tema=${encodeURIComponent(topic.slug)}`,
    };
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await loadArticle((await params).id);
  const description = excerpt(article.excerpt, 160) || undefined;
  const path = `/article/${article.id}`;
  return {
    title: article.title,
    description,
    alternates: { canonical: path },
    // Only another outlet's headline and excerpt: kept out of search results (links are still followed), so search
    // engines judge the site by its own pages. Sharing still works.
    robots: { index: false, follow: true },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: path,
      publishedTime: article.publishedAt,
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
    twitter: { card: article.imageUrl ? "summary_large_image" : "summary", title: article.title, description },
  };
}

export default async function ArticlePage({ params }: Props) {
  await connection();
  const article = await loadArticle((await params).id);
  const [comments, more, context] = await Promise.all([getComments(article.id), loadMore(article), loadContext(article)]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: excerpt(article.excerpt, 160) || undefined,
    datePublished: article.publishedAt,
    image: article.imageUrl ?? undefined,
    url: `${SITE_URL}/article/${article.id}`,
    isBasedOn: article.url ?? undefined,
    publisher: { "@type": "Organization", name: article.source },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so a hostile title cannot close this script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div data-wide className="grid gap-10 xl:grid-cols-[minmax(0,48rem)_20rem] xl:justify-between">
        <div className="min-w-0">
          <ArticleDetail article={article} />
          <CommentSection articleId={article.id} initialComments={comments} />
        </div>
        <ArticleSidebar articleId={article.id} parties={article.parties} more={more} context={context} />
      </div>
    </>
  );
}

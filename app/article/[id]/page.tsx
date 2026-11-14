import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleDetail } from "@/components/ArticleDetail";
import { CommentSection } from "@/components/CommentSection";
import { RelatedArticles } from "@/components/RelatedArticles";
import { ApiError, getArticle, getComments, getFeedPage } from "@/lib/api/client";
import { excerpt } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import type { Article } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

const RELATED_COUNT = 5;

async function loadArticle(param: string) {
  if (!/^\d+$/.test(param)) notFound();
  try {
    return await getArticle(Number(param));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

/** More news about the first party the article mentions, or the latest news. Never breaks the page. */
async function loadRelated(article: Article): Promise<{ title: string; articles: Article[] }> {
  const party = article.parties[0];
  try {
    const page = await getFeedPage({ party: party?.slug, limit: RELATED_COUNT + 1 });
    return {
      title: party ? `Mais sobre ${party.acronym}` : "Mais notícias",
      articles: page.articles.filter((item) => item.id !== article.id).slice(0, RELATED_COUNT),
    };
  } catch {
    return { title: "", articles: [] };
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
  const [comments, related] = await Promise.all([getComments(article.id), loadRelated(article)]);

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
      <ArticleDetail article={article} />
      <CommentSection articleId={article.id} initialComments={comments} />
      <RelatedArticles title={related.title} articles={related.articles} />
    </>
  );
}

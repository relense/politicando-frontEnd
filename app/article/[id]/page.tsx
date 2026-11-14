import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleCard } from "@/components/ArticleCard";
import { CommentSection } from "@/components/CommentSection";
import { ApiError, getArticle, getComments } from "@/lib/api/client";
import { excerpt } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

async function loadArticle(param: string) {
  if (!/^\d+$/.test(param)) notFound();
  try {
    return await getArticle(Number(param));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
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
  const comments = await getComments(article.id);

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
      <ArticleCard article={article} headingLevel={1} linkTitle={false} />
      <CommentSection articleId={article.id} initialComments={comments} />
    </>
  );
}

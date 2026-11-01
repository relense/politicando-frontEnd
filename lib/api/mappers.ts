import { decode } from "he";
import type { Article, Comment, Party } from "@/lib/types";
import type { ApiArticleDetail, ApiArticleListItem, ApiComment, ApiParty } from "./schemas";

/** External URLs reach the page as href/src, so only http(s) may pass. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function mapParty(party: ApiParty): Party {
  return { slug: party.slug, acronym: party.acronym, name: party.name, website: safeHttpUrl(party.website) };
}

export function mapArticle(article: ApiArticleListItem | ApiArticleDetail): Article {
  return {
    id: article.id,
    // Titles come from outside sources. Decode entities and always render as text, never as HTML.
    title: decode(article.title),
    content: "content" in article ? article.content : article.excerpt,
    publishedAt: article.publishedAt,
    url: safeHttpUrl(article.url),
    source: article.source,
    imageUrl: safeHttpUrl(article.imageUrl),
    parties: article.parties,
    commentsCount: article.commentCount,
  };
}

export function mapComment(comment: ApiComment): Comment {
  return {
    id: comment.id,
    username: comment.username || null,
    text: comment.body,
    parentId: comment.parentId,
    createdAt: comment.createdAt,
  };
}

import { decode } from "he";
import type { Article, Comment, Party } from "@/lib/types";
import { sourceName } from "@/lib/sources";
import type { ApiArticle, ApiComment, ApiParty } from "./schemas";

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

/** Some sources put markup in their summaries. Decoding first also catches encoded tags. */
function plainText(value: string): string {
  return decode(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function mapParty(party: ApiParty): Party {
  return { slug: party.slug, acronym: party.acronym, name: party.name, website: safeHttpUrl(party.website) };
}

export function mapArticle(article: ApiArticle): Article {
  return {
    id: article.id,
    // Text comes from outside sources. Decode entities and always render as text, never as HTML.
    title: decode(article.title),
    excerpt: plainText(article.excerpt),
    publishedAt: article.publishedAt,
    url: safeHttpUrl(article.url),
    source: sourceName(article.source),
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

export type ArticleParty = { slug: string; acronym: string; name: string };

export type Party = ArticleParty & { website: string | null };

export type Article = {
  id: number;
  title: string;
  /** The excerpt in lists, the full text on the article page. Only an excerpt is ever displayed. */
  content: string;
  publishedAt: string;
  url: string | null;
  source: string;
  imageUrl: string | null;
  parties: ArticleParty[];
  commentsCount: number;
};

export type ArticlePage = { articles: Article[]; nextCursor: string | null };

export type Comment = {
  id: number;
  username: string | null;
  text: string;
  parentId: number | null;
  createdAt: string | null;
  /** Shown while an optimistic comment is waiting for the API. */
  pending?: boolean;
};

export type NewComment = {
  articleId: number;
  parentId: number | null;
  username: string;
  text: string;
  captchaToken: string;
};

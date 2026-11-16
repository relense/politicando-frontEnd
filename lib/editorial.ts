import type { EditorialKind, EditorialPost } from "./types";

export const KIND_LABELS: Record<EditorialKind, string> = {
  article: "Artigo",
  opinion: "Opinião",
  podcast: "Podcast",
  interview: "Entrevista",
  video: "Vídeo",
};

/** Plural, for the filter. */
export const KIND_PLURALS: Record<EditorialKind, string> = {
  article: "Artigos",
  opinion: "Opinião",
  podcast: "Podcasts",
  interview: "Entrevistas",
  video: "Vídeos",
};

export const EDITORIAL_KINDS = Object.keys(KIND_LABELS) as EditorialKind[];

export const editorialPath = (slug: string) => `/editorial/${encodeURIComponent(slug)}`;

/** Audio players are short strips; video players keep the picture's shape. */
export const isAudio = (provider: string) =>
  ["spotify", "soundcloud", "apple", "apple_podcasts", "applepodcasts"].includes(provider.toLowerCase());

/** "4 min de leitura" for written posts; null for podcasts, videos and when the API doesn't say. */
export function readingLabel(post: Pick<EditorialPost, "kind" | "readingMinutes">): string | null {
  if (!post.readingMinutes || post.kind === "podcast" || post.kind === "video") return null;
  return `${post.readingMinutes} min de leitura`;
}

/**
 * Where podcast covers may come from. They are shown through our image optimiser only (next.config.ts reads this
 * list), so readers' browsers never contact these hosts; a cover from anywhere else is left out.
 * The API's covers (GET /podcast/latest) are all on i.scdn.co; Spotify's oEmbed fallback uses its image CDN.
 */
export const PODCAST_COVER_HOSTS = ["image-cdn-ak.spotifycdn.com", "image-cdn-fa.spotifycdn.com", "i.scdn.co"];

export const isAllowedCover = (url: string | null): url is string => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && PODCAST_COVER_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
};

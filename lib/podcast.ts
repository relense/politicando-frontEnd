import { PODCAST_SHOW_URL } from "@/lib/site";

/**
 * Our podcast on Spotify. The box points at the show (lib/site.ts), which never changes: Spotify's player starts on
 * the newest episode, so each new episode appears on the site by itself, with nothing to update here.
 */

export type Podcast = {
  kind: "show" | "episode";
  /** The page on Spotify; on a phone with the app, it opens in the app. */
  url: string;
  /** The player for an iframe. */
  embedUrl: string;
};

/** A Spotify show or episode link (as "Share" copies it, ?si=… included) as the page and player addresses; else null. */
export function podcastFromUrl(value: string | null | undefined): Podcast | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
  // /show/ID, /episode/ID, also with a language prefix (/intl-pt/show/ID) or already as /embed/…
  const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(show|episode)\/([A-Za-z0-9]{10,40})\/?$/);
  if (!match) return null;
  const [, kind, id] = match as unknown as [string, "show" | "episode", string];
  return {
    kind,
    url: `https://open.spotify.com/${kind}/${id}`,
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`,
  };
}

export const getPodcast = () => podcastFromUrl(PODCAST_SHOW_URL);

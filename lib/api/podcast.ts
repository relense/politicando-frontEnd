import { z } from "zod";
import { ApiError, hourly, request } from "@/lib/api/client";
import { safeHttpUrl } from "@/lib/api/mappers";
import { podcastFromUrl } from "@/lib/podcast";
import { PODCAST_SHOW_URL } from "@/lib/site";

/** The newest episode, for the player-style bar: shown without loading anything from Spotify in the reader's browser. */
export type PodcastEpisode = {
  title: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  /** Through our image optimiser only (next.config.ts), so the reader's browser never fetches it from elsewhere. */
  imageUrl: string | null;
  /** The episode on Spotify ("Abrir no Spotify"); null opens the show. */
  url: string | null;
  /** This episode's own player; null plays the show, which starts on its newest episode. */
  embedUrl: string | null;
};

// GET /podcast/latest (backend docs/podcast-api.md): read hourly from Spotify's show page. 404 until the first read.
// episodeNumber is always null (Spotify doesn't number episodes), so it isn't read.
const latestSchema = z.object({
  title: z.string().min(1),
  publishedAt: z.string().nullable().optional(),
  durationSeconds: z.number().positive().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  spotifyUrl: z.string().nullable().optional(),
});

// Spotify's public oEmbed for the show: the newest episode's title and cover, while the API has none.
const oembedSchema = z.object({ title: z.string().min(1), thumbnail_url: z.string().optional() });

export async function getLatestEpisode(): Promise<PodcastEpisode | null> {
  try {
    // Five minutes, not an hour: the API already reads Spotify hourly, and this is one cheap read.
    const latest = await request("/podcast/latest", latestSchema, { next: { revalidate: 300 } });
    // Only Spotify links: anything else is dropped (the box then opens and plays the show).
    const episode = podcastFromUrl(latest.spotifyUrl);
    return {
      title: latest.title.trim(),
      publishedAt: latest.publishedAt ?? null,
      durationSeconds: latest.durationSeconds ?? null,
      imageUrl: safeHttpUrl(latest.imageUrl),
      url: episode?.url ?? null,
      embedUrl: episode?.embedUrl ?? null,
    };
  } catch (error) {
    // None read yet or not deployed (404), or failing: Spotify's own summary of the show instead.
    if (!(error instanceof ApiError)) throw error;
  }
  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(PODCAST_SHOW_URL)}`, {
      ...hourly,
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const parsed = oembedSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    return {
      title: parsed.data.title.trim(),
      publishedAt: null,
      durationSeconds: null,
      imageUrl: safeHttpUrl(parsed.data.thumbnail_url),
      url: null,
      embedUrl: null,
    };
  } catch {
    return null;
  }
}

// GET /podcast?limit= (backend docs/podcast-api.md): newest first, the newest included. Each episode read on its own,
// so one malformed item doesn't empty the list.
const listSchema = z.object({ episodes: z.array(z.unknown()).catch([]) });
const listedSchema = z.object({
  title: z.string().min(1),
  publishedAt: z.string().nullable().optional(),
  durationSeconds: z.number().positive().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

/** The episodes before the newest one (the box above shows that), up to 10. Empty when there are none or the API fails. */
export async function getEarlierEpisodes(): Promise<PodcastEpisode[]> {
  try {
    const answer = await request("/podcast?limit=11", listSchema, { next: { revalidate: 300 } });
    // The first is the newest, whatever its shape: the box above shows it.
    const episodes = answer.episodes.slice(1).flatMap((item): PodcastEpisode[] => {
      const parsed = listedSchema.safeParse(item);
      if (!parsed.success) return [];
      // Only Spotify's own episode links: each row plays that episode.
      const link = podcastFromUrl(parsed.data.url);
      if (link?.kind !== "episode") return [];
      return [
        {
          title: parsed.data.title.trim(),
          publishedAt: parsed.data.publishedAt ?? null,
          durationSeconds: parsed.data.durationSeconds ?? null,
          imageUrl: safeHttpUrl(parsed.data.imageUrl),
          url: link.url,
          embedUrl: link.embedUrl,
        },
      ];
    });
    return episodes.slice(0, 10);
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
}

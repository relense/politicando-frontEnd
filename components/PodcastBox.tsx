"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PodcastEpisode } from "@/lib/api/podcast";
import { embedsAllowed, setEmbedsAllowed, subscribeEmbeds } from "@/lib/consent";
import type { Podcast } from "@/lib/podcast";
import { isAllowedCover } from "@/lib/podcastCovers";

type Props = {
  podcast: Podcast;
  /** The newest episode, from our server; without it the bar says just "Episódio mais recente" and plays the show. */
  episode: PodcastEpisode | null;
  headingId?: string;
  className?: string;
  /** Wider layout, for the bottom of the blog: the text beside the player instead of above it. */
  wide?: boolean;
};

/** Spotify's compact player. */
const PLAYER_HEIGHT = 152;

/**
 * Our podcast. Until the reader presses play, the bar only looks like Spotify's player: the episode, its cover and
 * length come from our server, so nothing is loaded from Spotify and it sets no cookies. Pressing ▶ is the reader
 * choosing to load Spotify's player, which then starts playing (or waits for a second press, if the browser or
 * Spotify won't start it). "Carregar sempre" shows the real player straight away on later visits.
 */
export function PodcastBox({ podcast, episode, headingId = "podcast", className = "", wide = false }: Props) {
  const remembered = useSyncExternalStore(subscribeEmbeds, embedsAllowed, () => false);
  const [pressed, setPressed] = useState(false);
  const embedUrl = episode?.embedUrl ?? podcast.embedUrl;

  const player = pressed ? (
    <SpotifyPlayer embedUrl={embedUrl} autoplay />
  ) : remembered ? (
    <SpotifyPlayer embedUrl={embedUrl} autoplay={false} />
  ) : (
    <>
      <EpisodeBar episode={episode} onPlay={() => setPressed(true)} />
      <p className="mt-2 text-[11px] leading-snug text-muted">
        O ▶ carrega o leitor do Spotify, que pode guardar cookies.{" "}
        <button type="button" onClick={() => setEmbedsAllowed(true)} className="underline hover:text-ink">
          Carregar sempre
        </button>{" "}
        ·{" "}
        <Link href="/cookies" className="underline hover:text-ink">
          Saber mais
        </Link>
      </p>
    </>
  );

  const openLink = (
    <a
      href={episode?.url ?? podcast.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-ink/70 px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
    >
      <SpotifyIcon /> Abrir no Spotify ↗<span className="sr-only"> (abre a app ou um novo separador)</span>
    </a>
  );

  return (
    <section
      aria-labelledby={headingId}
      className={`relative shrink-0 overflow-hidden rounded-2xl border border-line bg-[color-mix(in_srgb,#1db954_9%,var(--paper))] p-4 ${
        wide ? "sm:p-6" : ""
      } ${className}`}
    >
      <div className={wide ? "grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center" : ""}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-[color:var(--stage-debate)]">
              <MicIcon /> Podcast
            </p>
            {!wide && <span className="font-mono text-[11px] text-muted">Episódio mais recente</span>}
          </div>
          <h2 id={headingId} className={`mt-2 font-bold leading-snug ${wide ? "text-2xl sm:text-3xl" : "text-xl"}`}>
            Política, conversada
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            O que se passa no Parlamento, no Governo e nos partidos, explicado em voz alta.
          </p>
          {wide && <div className="hidden md:block md:max-w-xs">{openLink}</div>}
        </div>
        <div className={wide ? "" : "mt-3"}>
          {player}
          <div className={wide ? "md:hidden" : ""}>{openLink}</div>
        </div>
      </div>
    </section>
  );
}

/** Looks like Spotify's compact player; loads nothing from Spotify. */
function EpisodeBar({ episode, onPlay }: { episode: PodcastEpisode | null; onPlay: () => void }) {
  const title = episode?.title ?? "Episódio mais recente";
  const date = episode?.publishedAt ? shortDate(episode.publishedAt) : null;
  const details = [
    // Spotify's titles start with the date ("18 nov. · …"): not said twice.
    date && !title.toLowerCase().startsWith(date) ? date : null,
    episode?.durationSeconds ? `${Math.max(1, Math.round(episode.durationSeconds / 60))} min` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#121212] p-2.5 text-white">
      <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[#2a2a2a]">
        {isAllowedCover(episode?.imageUrl ?? null) ? (
          <Image src={episode!.imageUrl!} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-full items-center justify-center font-mono text-2xl font-bold text-[#f2c94c]">
            P
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-bold leading-snug">{title}</span>
        <span className="mt-1 block truncate font-mono text-[11px] text-white/70">
          {details.length > 0 ? details.join(" · ") : "Politicando · o podcast"}
        </span>
      </span>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Ouvir aqui: ${title}`}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <PlayIcon />
      </button>
    </div>
  );
}

/** "18 nov" (pt-PT on its own writes "18/11"). */
const shortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-PT", { ...options, timeZone: "Europe/Lisbon" }).format(date);
  return `${part({ day: "numeric" })} ${part({ month: "short" }).replace(".", "")}`;
};

// --- Spotify's player. With autoplay, through Spotify's iFrame API so the press that loaded it also starts it. ---

type Controller = { addListener: (event: string, callback: () => void) => void; play: () => void; destroy?: () => void };
type IFrameApi = {
  createController: (element: HTMLElement, options: Record<string, unknown>, callback: (controller: Controller) => void) => void;
};
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameApi) => void;
  }
}

let iframeApi: Promise<IFrameApi> | null = null;
/** Spotify's iFrame API, loaded once and only after the reader pressed play. */
function loadIframeApi(): Promise<IFrameApi> {
  iframeApi ??= new Promise<IFrameApi>((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onerror = () => {
      iframeApi = null;
      reject(new Error("Spotify iFrame API"));
    };
    document.body.appendChild(script);
  });
  return iframeApi;
}

/** spotify:episode:ID from https://open.spotify.com/embed/episode/ID?… */
const uriOf = (embedUrl: string) => {
  const match = new URL(embedUrl).pathname.match(/\/embed\/(show|episode)\/([A-Za-z0-9]+)/);
  return match ? `spotify:${match[1]}:${match[2]}` : null;
};

function SpotifyPlayer({ embedUrl, autoplay }: { embedUrl: string; autoplay: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  // The plain player when autoplay isn't wanted, or the iFrame API doesn't answer in time.
  const [plain, setPlain] = useState(!autoplay);

  useEffect(() => {
    if (plain) return;
    const uri = uriOf(embedUrl);
    if (!uri || !host.current) return setPlain(true);
    let controller: Controller | null = null;
    let done = false;
    // Spotify replaces the element it's given with its iframe, so it gets one React doesn't manage.
    const target = document.createElement("div");
    host.current.replaceChildren(target);
    const fallback = window.setTimeout(() => !done && setPlain(true), 4000);
    loadIframeApi()
      .then((api) =>
        api.createController(target, { uri, width: "100%", height: PLAYER_HEIGHT }, (created) => {
          done = true;
          window.clearTimeout(fallback);
          controller = created;
          created.addListener("ready", () => created.play());
        }),
      )
      .catch(() => setPlain(true));
    const element = host.current;
    return () => {
      window.clearTimeout(fallback);
      controller?.destroy?.();
      element.replaceChildren();
    };
  }, [embedUrl, plain]);

  if (plain) {
    return (
      <iframe
        src={embedUrl}
        title="Podcast do Politicando no Spotify"
        className="block w-full rounded-xl"
        style={{ height: PLAYER_HEIGHT }}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  return <div ref={host} className="overflow-hidden rounded-xl bg-[#121212]" style={{ height: PLAYER_HEIGHT }} />;
}

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-0.5 size-5" fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

/** Spotify's mark, in its green, to say where the link goes. */
function SpotifyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <circle cx="12" cy="12" r="11" fill="#1db954" />
      <path
        d="M6.5 9.3c3.8-1.1 8-.8 11.2 1M7.2 12.4c3.1-.9 6.5-.6 9.2.9M7.8 15.3c2.5-.7 5.1-.5 7.2.7"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

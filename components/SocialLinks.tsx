import type { ReactNode } from "react";
import { SOCIAL_PROFILES } from "@/lib/site";

/** Our profiles as small round buttons with the service's mark: X, Instagram, Threads, TikTok and the podcast on Spotify. */
export function SocialLinks({ className = "", withLabels = false }: { className?: string; withLabels?: boolean }) {
  return (
    <ul aria-label="Segue o Politicando" className={`flex flex-wrap gap-2 ${className}`}>
      {SOCIAL_PROFILES.map((profile) => (
        <li key={profile.key}>
          <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 rounded-full border border-line font-mono text-xs font-bold hover:bg-surface ${
              withLabels ? "py-1.5 pl-1.5 pr-3" : "p-1.5"
            }`}
          >
            {MARKS[profile.key]}
            {withLabels ? <span>{profile.label}</span> : null}
            <span className="sr-only">
              {withLabels ? ` no ${profile.name}` : `${profile.label} no ${profile.name}`} (abre num novo separador)
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function InstagramMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
      <circle cx="12" cy="12" r="12" fill="#d62976" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="3.2" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="15.2" cy="8.8" r="0.9" fill="#fff" />
    </svg>
  );
}

function TikTokMark() {
  return (
    <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-ink text-paper">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6Z" />
      </svg>
    </span>
  );
}

function ThreadsMark() {
  return (
    <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-ink text-paper">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M17.5 8.2C16.6 5.4 14.6 4 12 4 7.9 4 5.5 7 5.5 12s2.4 8 6.5 8c3 0 5.6-1.6 5.6-4.6 0-2.4-1.9-3.9-4.8-3.9-2.2 0-3.6 1-3.6 2.5 0 1.4 1.2 2.2 2.7 2.2 2.6 0 3.7-2 3.7-5.4" />
      </svg>
    </span>
  );
}

function XMark() {
  return (
    <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-ink text-paper">
      <svg viewBox="0 0 24 24" className="size-3" fill="currentColor">
        <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
      </svg>
    </span>
  );
}

function SpotifyMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
      <circle cx="12" cy="12" r="12" fill="#1db954" />
      <path
        d="M6.3 9.2c3.9-1.2 8.3-.8 11.6 1.1M7 12.4c3.2-1 6.8-.6 9.5 1M7.6 15.4c2.6-.8 5.3-.5 7.5.8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MARKS: Record<(typeof SOCIAL_PROFILES)[number]["key"], ReactNode> = {
  x: <XMark />,
  instagram: <InstagramMark />,
  threads: <ThreadsMark />,
  tiktok: <TikTokMark />,
  spotify: <SpotifyMark />,
};

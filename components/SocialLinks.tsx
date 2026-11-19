import type { ReactNode } from "react";
import { SOCIAL_PROFILES } from "@/lib/site";

type Variant = "icons" | "pills";

/**
 * Our profiles (X, Instagram, TikTok, Threads, the podcast on Spotify), one look everywhere: small square buttons with
 * each service's mark in the text colour, or, where there's room to say where to follow, pills with the handle.
 */
export function SocialLinks({
  className = "",
  variant = "icons",
  size = "md",
}: {
  className?: string;
  variant?: Variant;
  size?: "sm" | "md";
}) {
  const pills = variant === "pills";
  return (
    <ul aria-label="Segue o Politicando" className={`flex flex-wrap ${pills ? "gap-2" : "gap-1.5"} ${className}`}>
      {SOCIAL_PROFILES.map((profile) => (
        <li key={profile.key}>
          <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            title={pills ? undefined : `${profile.label} no ${profile.name}`}
            className={
              pills
                ? "flex items-center gap-2 rounded-xl border border-line py-1.5 pl-2 pr-3 font-mono text-xs font-bold hover:border-ink hover:bg-surface"
                : `flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink hover:bg-surface ${size === "sm" ? "size-7" : "size-[34px]"}`
            }
          >
            <span aria-hidden="true" className={`flex ${pills ? "size-6 items-center justify-center" : ""}`}>
              {MARKS[profile.key]}
            </span>
            {pills && <span>{profile.key === "spotify" ? "Spotify" : profile.label}</span>}
            <span className="sr-only">
              {pills ? ` no ${profile.name}` : `${profile.label} no ${profile.name}`} (abre num novo separador)
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const mark = (children: ReactNode, filled = false) => (
  <svg
    viewBox="0 0 24 24"
    className="size-3.5"
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const MARKS: Record<(typeof SOCIAL_PROFILES)[number]["key"], ReactNode> = {
  x: mark(
    <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />,
    true,
  ),
  instagram: mark(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
    </>,
  ),
  tiktok: mark(
    <path d="M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6Z" />,
    true,
  ),
  threads: mark(
    <path d="M17.5 8.2C16.6 5.4 14.6 4 12 4 7.9 4 5.5 7 5.5 12s2.4 8 6.5 8c3 0 5.6-1.6 5.6-4.6 0-2.4-1.9-3.9-4.8-3.9-2.2 0-3.6 1-3.6 2.5 0 1.4 1.2 2.2 2.7 2.2 2.6 0 3.7-2 3.7-5.4" />,
  ),
  spotify: mark(
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.2 9.6c3.3-1 6.9-.7 9.7.9M7.7 12.6c2.7-.8 5.6-.5 7.9.8M8.3 15.4c2.1-.6 4.2-.4 6 .6" />
    </>,
  ),
};

import { SOCIAL_PROFILES } from "@/lib/site";

/** Our profiles as small round buttons with the service's mark: X and the podcast on Spotify. */
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
            {profile.key === "x" ? <XMark /> : <SpotifyMark />}
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

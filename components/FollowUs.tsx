"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SocialLinks } from "./SocialLinks";

/*
 * Where readers meet our profiles: the feed never ends, so almost no one reaches the footer. The side column's end, a
 * card in the feed (once), and a strip after reading.
 */

const SIDE_LINKS = [
  { href: "/sobre", label: "Sobre" },
  { href: "/sobre#fontes", label: "Fontes" },
  { href: "/feedback/correcoes", label: "Correções" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/cookies", label: "Cookies" },
  { href: "/termos", label: "Termos" },
];

/** The end of the side column, always in view as it stays put beside the feed (as Reddit and X do). */
export function SidebarFooter() {
  return (
    <div className="px-1 pt-1">
      <SocialLinks size="sm" />
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
        {SIDE_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-ink hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[11px] text-muted">© {new Date().getFullYear()} Politicando</p>
    </div>
  );
}

const DISMISSED = "politicando:segue-dispensado";
const listeners = new Set<() => void>();
let memory = false;

const LAST_SHOWN = "politicando:segue-visto";
const EVERY = 7 * 24 * 60 * 60_000;
/** Decided once per page load: shown at most once a week, never again once dismissed. */
let decided: boolean | null = null;

function dismissed(): boolean {
  if (memory) return true;
  if (decided !== null) return decided;
  try {
    const last = Number(window.localStorage.getItem(LAST_SHOWN) ?? 0);
    decided = window.localStorage.getItem(DISMISSED) === "1" || Date.now() - last < EVERY;
    if (!decided) window.localStorage.setItem(LAST_SHOWN, String(Date.now()));
  } catch {
    decided = false;
  }
  return decided;
}

function dismiss() {
  memory = true;
  try {
    window.localStorage.setItem(DISMISSED, "1");
  } catch {
    // Private windows may refuse: hidden for this visit only.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** A card deep in the feed: at most once a week, and never again once dismissed, so it never reads as an advert. */
export function FollowCard({ headingId = "segue-o-politicando" }: { headingId?: string }) {
  const hidden = useSyncExternalStore(subscribe, dismissed, () => false);
  if (hidden) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="relative rounded-2xl border border-[var(--card-line)] bg-[var(--card)] p-5 sm:p-6 max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0 max-sm:px-4"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Segue o Politicando</p>
      <h2 id={headingId} className="mt-1.5 max-w-xl pr-8 text-xl font-bold leading-snug">
        As notícias de hoje, explicadas em 60 segundos, no TikTok e no Instagram.
      </h2>
      <SocialLinks variant="pills" className="mt-4" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar"
        title="Dispensar"
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </section>
  );
}

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

function dismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED) === "1" || memory;
  } catch {
    return memory;
  }
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

/** A card in the feed, after the 8th news: until the reader dismisses it, so it never reads as an advert. */
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

/** After reading: whoever got to the end will likely follow. Between the article and the conversation. */
export function FollowStrip({ className = "" }: { className?: string }) {
  return (
    <section
      aria-labelledby="segue-depois-de-ler"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-5 py-4 ${className}`}
    >
      <div>
        <h2 id="segue-depois-de-ler" className="font-bold leading-snug">
          Queres mais histórias assim?
        </h2>
        <p className="text-sm text-muted">Segue-nos onde já estás.</p>
      </div>
      <SocialLinks />
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

type Item = { href: string | null; label: string; hint: string; icon: ReactNode; active: (path: string) => boolean };

const icon = (path: string) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className="size-5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="round"
  >
    <path d={path} />
  </svg>
);

/** The site's sections. New sections are added here and appear on desktop and in the phone menu. */
export const SITE_SECTIONS: Item[] = [
  {
    href: "/",
    label: "Notícias",
    hint: "De todos os partidos",
    icon: icon("M4 4h9v12H5a1 1 0 0 1-1-1V4Zm9 3h3v8a1 1 0 0 1-1 1h-2M7 7h3M7 10h3M7 13h3"),
    active: (path) => path === "/" || path.startsWith("/partido/") || path.startsWith("/article/"),
  },
  {
    href: "/parlamento",
    label: "Parlamento",
    hint: "Deputados e iniciativas",
    icon: icon("M2 15a8 8 0 0 1 16 0M5.5 15a4.5 4.5 0 0 1 9 0M2 15h16"),
    active: (path) => path.startsWith("/parlamento"),
  },
  {
    href: "/deputados",
    label: "Deputados",
    hint: "Os 230, por partido",
    icon: icon("M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 8a6 6 0 0 1 12 0"),
    active: (path) => path.startsWith("/deputados"),
  },
  {
    href: "/governo",
    label: "Governo",
    hint: "Primeiro-Ministro e ministros",
    icon: icon("M3 8l7-4 7 4M4 8v7M8 8v7M12 8v7M16 8v7M2 17h16"),
    active: (path) => path.startsWith("/governo"),
  },
  {
    href: "/eleicoes",
    label: "Eleições",
    hint: "Resultados desde 2011",
    icon: icon("M4 9h12v8H4V9Zm3-5h6l1 5H6l1-5Zm1 9h4"),
    active: (path) => path.startsWith("/eleicoes"),
  },
  {
    href: "/historia",
    label: "História",
    hint: "Governos desde 1974",
    icon: icon("M10 3v14M6 6h4M10 10h4M6 14h4M4 3h12M4 17h12"),
    active: (path) => path.startsWith("/historia"),
  },
  {
    href: null,
    label: "Blog",
    hint: "Em breve",
    icon: icon("M5 3h7l3 3v11H5V3Zm7 0v3h3M8 10h4M8 13h4"),
    active: () => false,
  },
];

/** One section link. Sections without a page yet are shown, but not as links. */
export function SectionLink({
  item,
  onNavigate,
  compact = false,
}: {
  item: Item;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = item.active(pathname);
  const body = (
    <>
      {item.icon}
      <span className="min-w-0">
        <span className="block whitespace-nowrap font-mono text-sm font-bold">{item.label}</span>
        {!compact && <span className="block whitespace-nowrap text-xs text-muted">{item.hint}</span>}
      </span>
    </>
  );
  const base = "flex items-center gap-3 rounded-lg px-3 py-2";

  if (!item.href) {
    return (
      <span aria-disabled="true" className={`${base} text-muted`}>
        {body}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${base} ${active ? "bg-surface shadow-[inset_3px_0_0_var(--ink)]" : "hover:bg-surface"}`}
    >
      {body}
    </Link>
  );
}

/** Desktop: the site's sections in a sticky column on the left. */
export function SiteNav() {
  return (
    <nav aria-label="Secções" className="sticky top-20 hidden w-56 shrink-0 2xl:w-[var(--side-column)] self-start lg:block">
      <ul className="flex flex-col gap-1">
        {SITE_SECTIONS.map((item) => (
          <li key={item.label}>
            <SectionLink item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { SocialLinks } from "./SocialLinks";
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

/** The site's sections, in groups. New sections are added here and appear on desktop and in the phone menu. */
export const SITE_GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Notícias",
    items: [
      {
        href: "/",
        label: "Notícias",
        hint: "De todos os partidos",
        icon: icon("M4 4h9v12H5a1 1 0 0 1-1-1V4Zm9 3h3v8a1 1 0 0 1-1 1h-2M7 7h3M7 10h3M7 13h3"),
        active: (path) => path === "/" || path.startsWith("/article/"),
      },
      {
        href: "/editorial",
        label: "Blog",
        hint: "Artigos, opinião e podcasts",
        icon: icon("M5 3h7l3 3v11H5V3Zm7 0v3h3M8 10h4M8 13h4"),
        active: (path) => path.startsWith("/editorial"),
      },
      {
        href: "/guardadas",
        label: "Guardadas",
        hint: "As notícias que guardaste",
        icon: icon("M6 3h8a1 1 0 0 1 1 1v13l-5-3.5L5 17V4a1 1 0 0 1 1-1Z"),
        active: (path) => path.startsWith("/guardadas"),
      },
      {
        href: "/agenda",
        label: "Agenda",
        hint: "O que vem aí e onde assistir",
        icon: icon("M4 5h12v11H4V5Zm0 4h12M7 3v4M13 3v4M7 12h2M11 12h2"),
        active: (path) => path.startsWith("/agenda"),
      },
    ],
  },
  {
    title: "Quem manda",
    items: [
      {
        href: "/presidente",
        label: "Presidente",
        hint: "Promulgações e vetos",
        icon: icon("M10 2l2 4 4 .5-3 3 .8 4.5L10 12l-3.8 2 .8-4.5-3-3L8 6l2-4ZM5 18h10"),
        active: (path) => path.startsWith("/presidente"),
      },
      {
        href: "/governo",
        label: "Governo",
        hint: "Primeiro-Ministro e ministros",
        icon: icon("M3 8l7-4 7 4M4 8v7M8 8v7M12 8v7M16 8v7M2 17h16"),
        active: (path) => path.startsWith("/governo"),
      },
      {
        href: "/parlamento",
        label: "Parlamento",
        hint: "Os 230 deputados e onde se sentam",
        icon: icon("M2 15a8 8 0 0 1 16 0M5.5 15a4.5 4.5 0 0 1 9 0M2 15h16"),
        active: (path) => path.startsWith("/parlamento") || path.startsWith("/deputados"),
      },
      {
        href: "/partidos",
        label: "Partidos",
        hint: "Líderes, deputados e votos",
        icon: icon("M4 17V9m4 8V5m4 12v-6m4 6V7M2 17h16"),
        active: (path) => path.startsWith("/partidos") || path.startsWith("/partido/"),
      },
      {
        href: "/iniciativas",
        label: "Iniciativas",
        hint: "Leis e propostas, simples",
        icon: icon("M5 3h7l3 3v11H5V3Zm7 0v3h3M8 9h4M8 12h4M8 15h2"),
        active: (path) => path.startsWith("/iniciativas"),
      },
    ],
  },
  {
    title: "Território e dinheiro",
    items: [
      {
        href: "/eleicoes",
        label: "Eleições",
        hint: "Do país à freguesia",
        icon: icon("M4 9h12v8H4V9Zm3-5h6l1 5H6l1-5Zm1 9h4"),
        active: (path) => path.startsWith("/eleicoes"),
      },
      {
        href: "/sitios",
        label: "Autarquias",
        hint: "Quem governa cada concelho",
        icon: icon("M10 17s-5-4.6-5-8.5a5 5 0 0 1 10 0C15 12.4 10 17 10 17Zm0-6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"),
        active: (path) => path.startsWith("/sitios"),
      },
      {
        href: "/contratos",
        label: "Contratos",
        hint: "Dinheiro público",
        icon: icon("M4 3h9l3 3v11H4V3Zm9 0v3h3M7 9h6M7 12h6M7 15h3"),
        active: (path) => path.startsWith("/contratos"),
      },
    ],
  },
  {
    title: "Saber mais",
    items: [
      {
        href: "/historia",
        label: "História",
        hint: "Governos desde 1974",
        icon: icon("M10 3v14M6 6h4M10 10h4M6 14h4M4 3h12M4 17h12"),
        active: (path) => path.startsWith("/historia"),
      },
      {
        href: "/percursos",
        label: "Percursos",
        hint: "Como chegaram lá",
        icon: icon("M4 16c3-1 4-4 6-7s3-5 6-5M4 16a1.5 1.5 0 1 0 0 .01M16 4a1.5 1.5 0 1 0 0 .01"),
        active: (path) => path.startsWith("/percursos"),
      },
      {
        href: "/feedback",
        label: "Feedback",
        hint: "Erros, ideias e correções",
        icon: icon("M3 4h14v9H8l-4 3v-3H3V4Zm4 4h6M7 10h4"),
        active: (path) => path.startsWith("/feedback"),
      },
    ],
  },
];

export const SITE_SECTIONS: Item[] = SITE_GROUPS.flatMap((group) => group.items);

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
      {/* Wraps instead of overflowing: the column is narrower below 2xl. */}
      <span className="min-w-0 flex-1">
        <span className="block break-words font-mono text-sm font-bold">{item.label}</span>
        {!compact && <span className="block break-words text-xs leading-snug text-muted">{item.hint}</span>}
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
    <nav
      aria-label="Secções"
      className="no-scrollbar sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 self-start overflow-y-auto overflow-x-hidden pb-4 2xl:w-[var(--side-column)] lg:block"
    >
      {SITE_GROUPS.map((group, index) => (
        <div key={group.title} className={index > 0 ? "mt-4" : undefined}>
          <p aria-hidden="true" className="px-3 pb-1 font-mono text-xs font-bold uppercase tracking-widest text-muted">
            {group.title}
          </p>
          <ul aria-label={group.title} className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.label}>
                <SectionLink item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <SocialLinks className="mt-5 px-3" />
    </nav>
  );
}

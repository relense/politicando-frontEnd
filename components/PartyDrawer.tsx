"use client";

import Link from "next/link";
import { SocialLinks } from "./SocialLinks";
import { ThemeChoice } from "./ThemeChoice";
import type { Ref } from "react";
import { SectionLink, SITE_GROUPS } from "./SiteNav";

const DRAWER_LINKS = [
  { href: "/sobre", label: "Sobre" },
  { href: "/feedback/correcoes", label: "Correções" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
];

/** The site's sections on phones. A native modal dialog provides the focus trap, Esc to close, and the backdrop. */
export function PartyDrawer({ ref }: { ref: Ref<HTMLDialogElement> }) {
  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-paper text-ink shadow-xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">Menu</h2>
          <form method="dialog">
            <button type="submit" aria-label="Fechar menu" className="flex size-10 items-center justify-center rounded hover:bg-surface">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </form>
        </div>
        <nav aria-label="Secções" className="no-scrollbar flex-1 overflow-y-auto p-2">
          {SITE_GROUPS.map((group) => (
            <div key={group.title} className="pb-2">
              <p aria-hidden="true" className="px-3 pb-1 pt-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
                {group.title}
              </p>
              <ul aria-label={group.title} className="flex flex-col">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <SectionLink item={item} compact onNavigate={(event) => event.currentTarget.closest("dialog")?.close()} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {/* The phone's footer: few reach the real one under an endless feed. */}
          <div className="mx-3 mt-2 border-t border-line pb-3 pt-4">
            <p aria-hidden="true" className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
              Segue-nos
            </p>
            <SocialLinks className="justify-between" />
            <Link
              href="/newsletter"
              onClick={(event) => event.currentTarget.closest("dialog")?.close()}
              className="mt-4 flex h-10 items-center justify-center rounded-xl border border-line font-mono text-xs font-bold hover:bg-surface"
            >
              Receber a newsletter semanal
            </Link>
            <p aria-hidden="true" className="mb-2 mt-5 font-mono text-xs font-bold uppercase tracking-widest text-muted">
              Tema
            </p>
            <ThemeChoice />
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
              {DRAWER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={(event) => event.currentTarget.closest("dialog")?.close()} className="hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </dialog>
  );
}

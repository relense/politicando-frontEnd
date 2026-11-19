"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { signOut, useReader } from "@/lib/account";
import type { Reader } from "@/lib/api/account";
import { useReaderPrefs } from "@/lib/readerPrefs";
import { ThemeChoice } from "../ThemeChoice";
import { NotificationBell, useUnreadCount } from "./Inbox";

/** Where to come back to after logging in: this page, unless it's the login page itself. */
export function useReturnPath(): string {
  const pathname = usePathname();
  return pathname === "/entrar" || pathname === "/criar-conta" || pathname === "/conta" ? "/" : pathname;
}

const withReturn = (path: string, back: string) => (back === "/" ? path : `${path}?depois=${encodeURIComponent(back)}`);

export function Avatar({ reader, size = "md" }: { reader: Reader; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_20%,transparent)] font-mono font-bold uppercase text-brand ring-1 ring-[color-mix(in_srgb,var(--brand)_45%,transparent)] ${
        size === "lg" ? "size-10 text-base" : "size-7 text-xs"
      }`}
    >
      {reader.username.charAt(0)}
    </span>
  );
}

/**
 * The header's right corner. Without a session, "Entrar" and "Criar conta" (on phones one person icon); with one, the
 * avatar and the account menu, a sheet from the bottom on phones. Nothing until the session is known, so it never flickers.
 */
export function AccountMenu() {
  const reader = useReader();
  const back = useReturnPath();
  if (reader === undefined) return <span aria-hidden="true" className="block size-9" />;
  if (!reader)
    return (
      <>
        <Link
          href={withReturn("/entrar", back)}
          className="hidden min-h-9 items-center rounded-full px-3 font-mono text-xs font-bold hover:bg-surface sm:inline-flex"
        >
          Entrar
        </Link>
        <Link
          href={withReturn("/criar-conta", back)}
          className="hidden min-h-9 items-center rounded-full bg-ink px-4 font-mono text-xs font-bold text-paper hover:opacity-90 sm:inline-flex"
        >
          Criar conta
        </Link>
        <Link
          href={withReturn("/entrar", back)}
          aria-label="Entrar ou criar conta"
          className="-mr-2 flex size-10 items-center justify-center rounded-full hover:bg-surface sm:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </Link>
      </>
    );
  return <SignedIn reader={reader} />;
}

function SignedIn({ reader }: { reader: Reader }) {
  const id = useId();
  const client = useQueryClient();
  const prefs = useReaderPrefs();
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="relative flex items-center gap-1">
      <NotificationBell />
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen(!open)}
        className="-mr-1 flex min-h-9 items-center gap-2 rounded-full p-1 hover:bg-surface sm:border sm:border-line sm:pr-3"
      >
        <Avatar reader={reader} />
        <span className="hidden max-w-36 truncate font-mono text-xs font-bold sm:block">{reader.username}</span>
        <span className="sr-only sm:hidden">A tua conta, {reader.username}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="hidden size-3.5 fill-none stroke-current stroke-2 text-muted sm:block">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <div aria-hidden="true" onClick={close} className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent" />
          <div
            ref={panel}
            id={`${id}-menu`}
            role="region"
            aria-label="A tua conta"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-line bg-paper p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:rounded-2xl sm:pb-2"
          >
            <div className="flex items-center gap-3 border-b border-line px-2 pb-3 pt-2">
              <Avatar reader={reader} size="lg" />
              <span className="min-w-0">
                <b className="block truncate font-mono text-sm">{reader.username}</b>
                <span className="block font-mono text-[11px] text-muted">nome público nos comentários</span>
              </span>
            </div>
            <ul className="border-b border-line py-1">
              <MenuLink href="/guardadas" onClick={close} icon="M6 3h12v18l-6-4-6 4V3Z" count={prefs.saved.length}>
                Guardadas
              </MenuLink>
              <MenuLink
                href="/conta/notificacoes"
                onClick={close}
                icon="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"
                count={unread}
                countLabel="por ler"
              >
                Notificações
              </MenuLink>
              <MenuLink href="/conta/comentarios" onClick={close} icon="M4 5h16v11H8l-4 4V5Z">
                Os meus comentários
              </MenuLink>
              <MenuLink href="/conta/previsoes" onClick={close} icon="M4 19V5m0 14h16M8 15l3-4 3 2 5-6">
                As minhas previsões
              </MenuLink>
              <MenuLink href="/newsletter" onClick={close} icon="M3 6h18v12H3V6Zm0 0 9 7 9-7">
                Newsletter semanal
              </MenuLink>
            </ul>
            <div className="border-b border-line px-2 py-3">
              <p aria-hidden="true" className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Tema
              </p>
              <ThemeChoice />
            </div>
            <ul className="pt-1">
              <MenuLink
                href="/conta"
                onClick={close}
                icon="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-6v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"
              >
                Definições da conta
              </MenuLink>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    void signOut(client);
                  }}
                  className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left font-mono text-xs font-bold text-danger hover:bg-surface"
                >
                  <MenuIcon path="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
                  Terminar sessão
                </button>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function MenuIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 fill-none stroke-current stroke-[1.8] text-muted">
      <path d={path} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MenuLink({
  href,
  icon,
  count,
  countLabel = "guardadas",
  onClick,
  children,
}: {
  href: string;
  icon: string;
  count?: number;
  countLabel?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex min-h-10 items-center gap-3 rounded-lg px-2 font-mono text-xs font-bold hover:bg-surface"
      >
        <MenuIcon path={icon} />
        <span className="flex-1">{children}</span>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">
            {count}
            <span className="sr-only"> {countLabel}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

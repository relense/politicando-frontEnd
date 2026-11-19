"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { readerPrefs, toggleIn, updateReaderPrefs, useReaderPrefs, type ReaderPrefs } from "@/lib/readerPrefs";
import { ReportButton } from "./forum/ReportButton";
import { useAccountGate } from "@/lib/account";

type MenuArticle = { id: number; title: string; source: string; sourceDomain: string; parties: { slug: string; acronym: string }[] };

/** What each "hide" changed and how to say it, so the feed can offer to undo it (kept for this visit only). */
export const undoable = new Map<number, { before: ReaderPrefs; message: string }>();

function change(id: number, message: string, edit: (prefs: ReaderPrefs) => ReaderPrefs) {
  undoable.set(id, { before: readerPrefs(), message });
  updateReaderPrefs(edit);
}

/**
 * The "…" on a news card: save (with an account), hide, why it's shown, and report. Hiding stays in this browser
 * too (see lib/readerPrefs.ts); with an account the account keeps it all.
 */
export function ArticleMenu({ article, why }: { article: MenuArticle; why: string }) {
  const prefs = useReaderPrefs();
  const [open, setOpen] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [reporting, setReporting] = useState(false);
  const gate = useAccountGate();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const saved = prefs.saved.includes(article.id);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface";
  const close = () => {
    setOpen(false);
    setExplaining(false);
  };

  return (
    // Raised while open, so the panel covers the card's photo and buttons below it.
    <div ref={box} className={`relative ${open || reporting ? "z-30" : "z-10"}`}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Mais opções para «${article.title}»`}
        onClick={() => setOpen(!open)}
        className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
          <circle cx="4.5" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="15.5" cy="10" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-label="Opções da notícia"
          className="absolute right-0 top-full z-30 mt-1 w-72 rounded-2xl border border-line bg-paper p-1.5 shadow-xl"
        >
          <button
            type="button"
            aria-pressed={saved}
            className={item}
            onClick={(event) => {
              // The note points at the "…", as the menu closes.
              const blocked = gate("save", button.current ?? event.currentTarget);
              close();
              if (blocked) return;
              updateReaderPrefs((current) => ({ ...current, saved: toggleIn(current.saved, article.id) }));
            }}
          >
            <Icon d="M6 3h8a1 1 0 0 1 1 1v13l-5-3.5L5 17V4a1 1 0 0 1 1-1Z" filled={saved} />
            {saved ? "Tirar das guardadas" : "Guardar"}
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              change(article.id, "Notícia escondida", (current) => ({ ...current, hidden: [...current.hidden, article.id] }));
              close();
            }}
          >
            <Icon d="M3 3l14 14M8.5 5.2A7.6 7.6 0 0 1 10 5c5 0 8 5 8 5a14 14 0 0 1-2.4 2.9M5.4 6.6C3.3 8 2 10 2 10s3 5 8 5c1.2 0 2.3-.3 3.3-.7" />
            Esconder
          </button>
          <button type="button" aria-expanded={explaining} className={item} onClick={() => setExplaining(!explaining)}>
            <Icon d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM7.8 7.5a2.3 2.3 0 1 1 3 2.2c-.5.2-.8.6-.8 1.1v.7M10 14.2v.1" />
            Porque vejo isto?
          </button>
          {explaining && <p className="mx-3 mb-2 rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-muted">{why}</p>}
          <button
            type="button"
            className={item}
            onClick={() => {
              close();
              if (!gate("report", button.current)) setReporting(true);
            }}
          >
            <Icon d="M5 17V3m0 1h9l-2 3.5 2 3.5H5" />
            Denunciar
          </button>
          {prefs.saved.length > 0 && (
            <Link href="/guardadas" className={`${item} border-t border-line font-mono text-xs font-bold`} onClick={close}>
              Ver as guardadas ({prefs.saved.length})
            </Link>
          )}
        </div>
      )}
      {reporting && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-paper shadow-xl">
          <ReportButton kind="article" id={article.id} startOpen onClose={() => setReporting(false)} />
        </div>
      )}
    </div>
  );
}

function Icon({ d, filled = false }: { d: string; filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

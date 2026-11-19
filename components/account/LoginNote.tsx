"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { LoginAsk } from "@/lib/account";
import { ASK_COPY } from "@/lib/participation";
import { savePending } from "@/lib/pendingAction";
import { GOLD, OUTLINE } from "./ui";

const PHONE = "(max-width: 639px)";
const subscribePhone = (callback: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const useIsPhone = () =>
  useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );

const WIDTH = 288;
const GAP = 10;

/**
 * Asking for an account without sending the reader away: a small note next to the button they pressed, saying what an
 * account does for that action. It covers nothing else, and closes with ×, Esc or a click outside. On phones there's no
 * room for notes: the same content in a sheet from the bottom, within the thumb's reach, closed by dragging it down.
 * What they were doing is kept, and the page finishes it after they log in.
 */
export function LoginNote({ ask, back, onClose }: { ask: LoginAsk; back: string; onClose: () => void }) {
  const id = useId();
  const phone = useIsPhone();
  const note = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number; arrow: number; above: boolean } | null>(null);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const copy = ASK_COPY[ask.kind];
  const anchored = Boolean(ask.anchor) && !phone;
  const next = back === "/" ? "" : `?depois=${encodeURIComponent(back)}`;

  // Next to the button, below it unless there's no room, and kept there while the page scrolls.
  useLayoutEffect(() => {
    if (!anchored || !ask.anchor) return;
    const anchor = ask.anchor;
    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      const height = note.current?.offsetHeight ?? 260;
      const above = rect.bottom + GAP + height > window.innerHeight && rect.top - GAP - height > 0;
      const center = rect.left + rect.width / 2;
      const left = Math.min(Math.max(12, center - WIDTH / 2), window.innerWidth - WIDTH - 12);
      setPlace({ top: above ? rect.top - GAP - height : rect.bottom + GAP, left, arrow: center - left, above });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [anchored, ask.anchor]);

  useEffect(() => {
    note.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    const close = (focusBack: boolean) => {
      onClose();
      if (focusBack) ask.anchor?.focus({ preventScroll: true });
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close(true);
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!note.current?.contains(target) && !ask.anchor?.contains(target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [ask.anchor, onClose]);

  const keep = () => {
    if (ask.pending) savePending(back, ask.pending);
    onClose();
  };

  const style: CSSProperties = anchored
    ? { position: "fixed", top: place?.top ?? -9999, left: place?.left ?? 0, width: WIDTH, visibility: place ? "visible" : "hidden" }
    : phone
      ? { transform: drag ? `translateY(${drag}px)` : undefined }
      : {};

  return (
    <>
      {phone && <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/50" />}
      <div
        ref={note}
        role="dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        style={style}
        onTouchStart={phone ? (event) => (dragStart.current = event.touches[0]!.clientY) : undefined}
        onTouchMove={
          phone ? (event) => dragStart.current !== null && setDrag(Math.max(0, event.touches[0]!.clientY - dragStart.current)) : undefined
        }
        onTouchEnd={
          phone
            ? () => {
                dragStart.current = null;
                if (drag > 80) onClose();
                setDrag(0);
              }
            : undefined
        }
        className={`z-50 border border-line bg-[var(--card)] shadow-2xl ${
          anchored
            ? "rounded-2xl p-4"
            : phone
              ? "fixed inset-x-0 bottom-0 rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
              : "fixed inset-x-4 bottom-4 mx-auto max-w-sm rounded-2xl p-4"
        }`}
      >
        {anchored && place && (
          <span
            aria-hidden="true"
            className={`absolute size-3 rotate-45 border-line bg-[var(--card)] ${place.above ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-l border-t"}`}
            style={{ left: Math.min(Math.max(16, place.arrow - 6), WIDTH - 28) }}
          />
        )}
        {phone && <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" />}
        {!phone && (
          <button
            type="button"
            onClick={() => {
              onClose();
              ask.anchor?.focus({ preventScroll: true });
            }}
            aria-label="Fechar"
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a6500] dark:text-[#f2c94c]">{copy.label}</p>
        <p id={`${id}-title`} className="mt-1 pr-6 font-serif text-lg font-bold leading-snug">
          {copy.title}
        </p>
        <p id={`${id}-text`} className="mt-1 text-sm leading-relaxed text-muted">
          {copy.text}
        </p>
        <div className={`mt-4 grid gap-2 ${phone ? "" : "grid-cols-2"}`}>
          <Link href={`/criar-conta${next}`} onClick={keep} className={GOLD}>
            Criar conta
          </Link>
          <Link href={`/entrar${next}`} onClick={keep} className={OUTLINE}>
            {phone ? "Já tenho conta · Entrar" : "Entrar"}
          </Link>
        </div>
        {copy.after && <p className="mt-3 font-mono text-[11px] text-muted">{copy.after}</p>}
        {phone && (
          <button type="button" onClick={onClose} className="mt-2 w-full py-2 font-mono text-xs font-bold text-muted">
            Agora não
          </button>
        )}
      </div>
    </>
  );
}

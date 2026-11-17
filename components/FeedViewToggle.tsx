"use client";

import { useEffect, useId, useRef, useState } from "react";
import { setFeedView, useFeedView, type FeedView } from "@/lib/feedView";

const CardsIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]">
    <rect x="2.5" y="2.5" width="11" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="11" height="4.5" rx="1" />
  </svg>
);
const ListIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]" strokeLinecap="round">
    <path d="M2.5 3.5h7M2.5 6.5h5M2.5 9.5h7M2.5 12.5h5" />
    <rect x="11" y="3" width="2.5" height="4" rx=".5" />
    <rect x="11" y="9" width="2.5" height="4" rx=".5" />
  </svg>
);
const VIEWS: { value: FeedView; label: string; icon: React.ReactNode }[] = [
  { value: "cartoes", label: "Cartões", icon: <CardsIcon /> },
  { value: "lista", label: "Lista compacta", icon: <ListIcon /> },
];

/** Cards or a compact list: a small menu at the end of the order tabs, showing the current one's icon. */
export function FeedViewToggle({ initial }: { initial: FeedView }) {
  const view = useFeedView(initial);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const current = VIEWS.find((item) => item.value === view)!;

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

  return (
    <div ref={box} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        title="Vista das notícias"
        onClick={() => setOpen(!open)}
        className={`flex h-8 items-center gap-1 rounded-full px-2 text-muted hover:bg-surface hover:text-ink ${open ? "bg-surface text-ink" : ""}`}
      >
        {current.icon}
        <span className="sr-only">Vista das notícias: {current.label}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-3 fill-none stroke-current stroke-2 ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-label="Vista das notícias"
          className="absolute right-0 z-30 mt-2 flex w-48 flex-col gap-1 rounded-2xl border border-line bg-paper p-2 font-mono text-xs font-bold shadow-xl"
        >
          {VIEWS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={view === item.value}
              onClick={() => {
                setFeedView(item.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left ${view === item.value ? "bg-ink text-paper" : "hover:bg-surface"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

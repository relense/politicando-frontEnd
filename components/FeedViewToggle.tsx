"use client";

import { setFeedView, useFeedView, type FeedView } from "@/lib/feedView";

/** Cards or a compact list: two small buttons beside the order. */
export function FeedViewToggle({ initial }: { initial: FeedView }) {
  const view = useFeedView(initial);
  const button = (value: FeedView, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={view === value}
      title={label}
      onClick={() => setFeedView(value)}
      className={`flex size-8 items-center justify-center rounded-full ${view === value ? "bg-ink text-paper" : "text-muted hover:bg-surface hover:text-ink"}`}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Vista das notícias"
      className="flex h-10 shrink-0 items-center gap-0.5 rounded-full border border-line px-1"
    >
      {button(
        "cartoes",
        "Cartões",
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]">
          <rect x="2.5" y="2.5" width="11" height="4.5" rx="1" />
          <rect x="2.5" y="9" width="11" height="4.5" rx="1" />
        </svg>,
      )}
      {button(
        "lista",
        "Lista compacta",
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]" strokeLinecap="round">
          <path d="M2.5 3.5h7M2.5 6.5h5M2.5 9.5h7M2.5 12.5h5" />
          <rect x="11" y="3" width="2.5" height="4" rx=".5" />
          <rect x="11" y="9" width="2.5" height="4" rx=".5" />
        </svg>,
      )}
    </div>
  );
}

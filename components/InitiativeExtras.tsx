"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getInitiative } from "@/lib/api/client";
import type { Prediction } from "@/lib/api/engagement";
import { formatNumber, formatRelative, formatTime } from "@/lib/format";
import { initiativePath } from "@/lib/initiatives";
import type { CoverageArticle, Initiative } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { timeLeft } from "./Predictions";
import { RelativeTime } from "./RelativeTime";
import { SourceLogo } from "./SourceLogo";

/** The open vote's colour on the initiatives list (green-blue, apart from the stages' colours). */
export const POLL_TEXT = "text-[#17766b] dark:text-[#5fd3c4]";
export const POLL_LINE = "#3fb8a9";

const weekdayTime = (value: string) =>
  `${new Intl.DateTimeFormat("pt-PT", { weekday: "long", timeZone: "Europe/Lisbon" }).format(new Date(value)).replace("-feira", "")}, ${formatTime(value)}`;

/** "Passa ou chumba? Vai a votos quinta, 15:00 · fecha em 10 h 54 min · 54 a discutir", and the way to predict. */
export function PollStrip({ initiativeId, poll }: { initiativeId: number; poll: Prediction }) {
  const now = useNow();
  const left = timeLeft(poll.closesAt, now);
  if (!left) return null;
  return (
    <div
      className="mt-4 flex items-center gap-3 rounded-xl border p-2.5"
      style={{
        borderColor: `color-mix(in srgb, ${POLL_LINE} 45%, var(--line))`,
        background: `color-mix(in srgb, ${POLL_LINE} 8%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${POLL_TEXT}`}
        style={{ background: `color-mix(in srgb, ${POLL_LINE} 18%, transparent)` }}
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
          <path d="M5 15a7 7 0 0 1 14 0" />
          <path d="M12 15l3-4" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug">Passa ou chumba?{poll.closesAt && <> Vai a votos {weekdayTime(poll.closesAt)}</>}</p>
        <p className="font-mono text-[11px] text-muted">
          <span className="font-bold text-[var(--contra)]">● fecha em {left}</span>
          {poll.replyCount !== null && <> · {formatNumber(poll.replyCount)} a discutir</>}
        </p>
      </div>
      <Link
        prefetch={false}
        href={`${initiativePath(initiativeId)}#previsao-iniciativa`}
        className="shrink-0 rounded-full px-3.5 py-1.5 font-mono text-xs font-bold text-[#0f2e2a]"
        style={{ background: POLL_LINE }}
      >
        {poll.myPick ? "Mudar" : "Prever"}
        <span className="sr-only"> «{poll.plain?.title ?? poll.title}»</span>
      </Link>
    </div>
  );
}

/**
 * The news about it, in one line: none, nothing; one, its headline and outlet; more, up to three outlets stacked, the
 * count and the latest, with the three latest opening below and the rest on the initiative's page.
 */
export function NewsLine({ initiative }: { initiative: Initiative }) {
  const { articles: total, lastAt, latest } = initiative.coverage;
  const [open, setOpen] = useState(false);
  const now = useNow();
  // Without headlines in the list, they load when opened.
  const detail = useQuery({
    queryKey: ["initiative", initiative.id],
    queryFn: () => getInitiative(initiative.id),
    enabled: open && latest.length < Math.min(3, total),
    staleTime: 5 * 60_000,
  });
  if (total === 0) return null;
  const items: CoverageArticle[] =
    latest.length > 0
      ? latest
      : [...(detail.data?.articles ?? [])].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 3);
  const first = latest[0];
  const outlets = [...new Map(latest.map((item) => [item.source, item])).values()].slice(0, 3);
  const page = `${initiativePath(initiative.id)}#noticias`;
  const count = `${formatNumber(total)} ${total === 1 ? "notícia" : "notícias"}`;

  return (
    <div className="mt-3 rounded-xl border border-line">
      <div className="flex items-center gap-3 p-2.5">
        {outlets.length > 0 && (
          <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
            {outlets.map((item) => (
              <span key={item.source} className="overflow-hidden rounded-md ring-2 ring-[var(--paper)]">
                <SourceLogo domain={item.sourceDomain} name={item.source} size={22} square />
              </span>
            ))}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] text-muted">
            <b className="text-ink">{count}</b>
            {lastAt && <> · última {formatRelative(lastAt, now)}</>}
          </p>
          {first ? (
            <Link prefetch={false} href={`/article/${first.id}`} className="block truncate text-sm hover:underline">
              <span className="text-muted">{first.source}: </span>
              {first.title}
            </Link>
          ) : (
            total === 1 && (
              <Link prefetch={false} href={page} className="font-mono text-[11px] font-bold underline underline-offset-2">
                Ver a notícia →
              </Link>
            )
          )}
        </div>
        {total > 1 && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold text-muted hover:bg-surface hover:text-ink"
          >
            {open ? "Esconder ▴" : "Abrir ▾"}
            <span className="sr-only"> as notícias sobre «{initiative.title}»</span>
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-line px-2.5 pb-2.5">
          {items.length > 0 ? (
            <ul aria-label="Últimas notícias" className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2 sm:grid-cols-[7rem_minmax(0,1fr)_auto]">
                  <span className="truncate font-mono text-[11px] text-muted max-sm:col-span-2">{item.source}</span>
                  <Link prefetch={false} href={`/article/${item.id}`} className="text-sm leading-snug hover:underline">
                    {item.title}
                  </Link>
                  <RelativeTime value={item.publishedAt} className="font-mono text-[11px] text-muted" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 font-mono text-[11px] text-muted">{detail.isError ? "Não foi possível carregar." : "A carregar…"}</p>
          )}
          <Link prefetch={false} href={page} className="mt-1 inline-block font-mono text-[11px] font-bold underline underline-offset-2">
            Ver as {count} na página da iniciativa →
          </Link>
        </div>
      )}
    </div>
  );
}

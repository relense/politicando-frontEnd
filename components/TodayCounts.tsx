"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";

/**
 * «Hoje: N notícias»: how many articles each outlet published since 05:00, most first, as bars to compare at a glance
 * (not links). A second tab counts the articles about each party. The top 5, then «Ver todos».
 */

export type CountRow = { key: string; label: string; count: number; color?: string };

const SHOWN = 5;
const label = "font-mono text-[11px] font-bold uppercase tracking-widest";

export function TodayCounts({ total, sources, parties }: { total: number; sources: CountRow[]; parties: CountRow[] }) {
  const [tab, setTab] = useState<"sources" | "parties">(sources.length > 0 ? "sources" : "parties");
  const [all, setAll] = useState(false);
  const rows = tab === "sources" ? sources : parties;
  const most = Math.max(1, ...rows.map((row) => row.count));
  const shown = all ? rows : rows.slice(0, SHOWN);
  const tabs = sources.length > 0 && parties.length > 0;
  return (
    <section aria-labelledby="hoje-contagem" className="rounded-2xl border border-line p-4">
      <h2 id="hoje-contagem" className="text-lg font-bold leading-tight">
        Hoje: {formatNumber(total)} {total === 1 ? "notícia" : "notícias"}
      </h2>
      <p className="font-mono text-[11px] text-muted">desde as 05:00</p>
      {tabs && (
        <div className="mt-3 flex gap-1">
          {(
            [
              ["sources", "Jornais"],
              ["parties", "Partidos"],
            ] as const
          ).map(([key, name]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={`${label} rounded-full border px-2.5 py-1 ${tab === key ? "border-ink bg-ink text-paper" : "border-line text-muted hover:bg-surface"}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <ol className="mt-3 flex flex-col gap-2">
        {shown.map((row) => (
          <li key={row.key} className="text-sm">
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="font-mono text-xs font-bold tabular-nums">{formatNumber(row.count)}</span>
            </span>
            <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
              <span
                data-bar
                className="block h-full rounded-full bg-brand"
                style={{ width: `${(row.count / most) * 100}%`, ...(row.color ? { backgroundColor: row.color } : {}) }}
              />
            </span>
          </li>
        ))}
      </ol>
      {rows.length > SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 font-mono text-xs font-bold underline">
          {all ? "Ver menos" : `Ver todos (${rows.length})`}
        </button>
      )}
      {tab === "parties" && (
        <p className="mt-3 font-mono text-[11px] text-muted">Uma notícia pode falar de vários partidos, por isso a soma passa o total.</p>
      )}
    </section>
  );
}

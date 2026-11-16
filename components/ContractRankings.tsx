"use client";

import Link from "next/link";
import { useState } from "react";
import { contractsLabel, formatEurosShort, share, type ContractGroup } from "@/lib/api/contracts";

export type RankingTab = { key: string; label: string; title: string; items: ContractGroup[]; hrefs: (string | null)[]; note?: string };

/** Who contracts and who gets paid, one tab at a time: public bodies, companies, municipalities. */
export function ContractRankings({ tabs }: { tabs: RankingTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  return (
    <div>
      <div role="tablist" aria-label="Ver por" className="mb-4 inline-flex rounded-lg border border-line p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={tab.key === active}
            aria-controls={`painel-${tab.key}`}
            onClick={() => setActive(tab.key)}
            className={`rounded-md px-3 py-1 font-mono text-xs font-bold ${tab.key === active ? "bg-ink text-paper" : "hover:bg-surface"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => {
        const max = tab.items[0]?.total ?? 0;
        return (
          <div key={tab.key} role="tabpanel" id={`painel-${tab.key}`} aria-labelledby={`tab-${tab.key}`} hidden={tab.key !== active}>
            <p className="mb-2 text-sm text-muted">{tab.title}</p>
            {tab.items.length === 0 ? (
              <p className="text-sm text-muted">Sem dados.</p>
            ) : (
              <ol aria-label={tab.title} className="divide-y divide-line rounded-2xl border border-line">
                {tab.items.map((item, index) => {
                  const href = tab.hrefs[index];
                  return (
                    <li key={item.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3">
                      <span className="font-mono text-xs text-[color:var(--stage-debate)]">{index + 1}</span>
                      <span className="min-w-0">
                        <span className="block break-words font-bold leading-snug">
                          {href ? (
                            <Link href={href} className="hover:underline">
                              {item.label}
                            </Link>
                          ) : (
                            item.label
                          )}
                        </span>
                        <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-surface">
                          <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(1, share(item.total, max))}%` }} />
                        </span>
                        <span className="mt-1 block font-mono text-[11px] text-muted">{contractsLabel(item.count)}</span>
                      </span>
                      <span className="whitespace-nowrap font-mono text-sm font-bold tabular-nums">{formatEurosShort(item.total)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            {tab.note && <p className="mt-3 text-xs leading-relaxed text-muted">{tab.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

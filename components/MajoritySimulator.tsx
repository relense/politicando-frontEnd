"use client";

import { useState } from "react";
import { majority } from "@/lib/parliament";
import { Chamber } from "./Chamber";

export type SimulatorList = { key: string; label: string; name: string; color: string; seats: number };

/** The chamber that came out of an election, and a way to add up lists to see who could form a majority. */
export function MajoritySimulator({ lists, total, initial }: { lists: SimulatorList[]; total: number; initial: string[] }) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(initial));
  const needed = majority(total);
  // Biggest first when naming the sum: "AD + IL".
  const picked = lists.filter((item) => chosen.has(item.key)).sort((a, b) => b.seats - a.seats);
  const sum = picked.reduce((total, item) => total + item.seats, 0);
  const toggle = (key: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
      <Chamber
        total={total}
        // Small chambers (a district's 16 seats) would draw huge seats at full width.
        className={total < 60 ? "mx-auto w-full max-w-xs" : total < 150 ? "mx-auto w-full max-w-md" : ""}
        groups={lists.map((item) => ({
          key: item.key,
          color: item.color,
          seats: item.seats,
          dimmed: chosen.size > 0 && !chosen.has(item.key),
        }))}
      >
        <p className="text-3xl font-bold leading-none sm:text-5xl">{chosen.size > 0 ? sum : total}</p>
        <p className="mt-1 font-mono text-[11px] text-muted">{chosen.size > 0 ? "mandatos selecionados" : "mandatos"}</p>
      </Chamber>
      <div className="rounded-2xl border border-line p-4">
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest">Simulador de maioria</h3>
        <p className="mt-2 text-sm">Escolhe listas para somar mandatos. São precisos {needed}.</p>
        <div role="group" aria-label="Listas a somar" className="mt-3 flex flex-wrap gap-1.5">
          {lists.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={chosen.has(item.key)}
              title={item.name}
              onClick={() => toggle(item.key)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-bold ${
                chosen.has(item.key) ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
              }`}
            >
              <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label} <span className={chosen.has(item.key) ? "" : "font-normal text-muted"}>{item.seats}</span>
            </button>
          ))}
        </div>
        <div aria-hidden="true" className="relative mt-4 h-2 rounded-full bg-surface">
          <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.min(sum / total, 1) * 100}%` }} />
          <div className="absolute -inset-y-1 border-l-2 border-dashed border-muted" style={{ left: `${(needed / total) * 100}%` }} />
        </div>
        <p aria-live="polite" className="mt-3 min-h-10 font-mono text-xs font-bold">
          {picked.length === 0
            ? `Maioria absoluta: ${needed} de ${total} mandatos.`
            : `${picked.map((item) => item.label).join(" + ")}: ${sum} mandatos · ${sum >= needed ? "maioria absoluta" : `faltam ${needed - sum} para a maioria`}`}
        </p>
        {chosen.size > 0 && (
          <button
            type="button"
            onClick={() => setChosen(new Set())}
            className="mt-2 rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}

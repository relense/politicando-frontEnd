"use client";

import Link from "next/link";
import { useState } from "react";

export type CircleTile = {
  /** dicofre for districts ("11"), or "EUR" / "FEU" for the two circles abroad. */
  code: string;
  name: string;
  href: string;
  mandates: number | null;
  color: string | null;
  winner: string | null;
  top: { label: string; color: string; pct: string | null; share: number; mandates: number | null }[];
};

/** Where each circle sits: roughly its place on the map, one square each, the islands and abroad on the right. */
const GRID: Record<string, { abbr: string; col: number; row: number }> = {
  "16": { abbr: "VCT", col: 1, row: 1 },
  "03": { abbr: "BRG", col: 2, row: 1 },
  "17": { abbr: "VRL", col: 3, row: 1 },
  "04": { abbr: "BGC", col: 4, row: 1 },
  "13": { abbr: "PRT", col: 1, row: 2 },
  "18": { abbr: "VIS", col: 3, row: 2 },
  "09": { abbr: "GRD", col: 4, row: 2 },
  "01": { abbr: "AVR", col: 1, row: 3 },
  "06": { abbr: "CBR", col: 2, row: 3 },
  "05": { abbr: "CTB", col: 3, row: 3 },
  "10": { abbr: "LRA", col: 1, row: 4 },
  "14": { abbr: "STR", col: 2, row: 4 },
  "12": { abbr: "PTG", col: 3, row: 4 },
  "11": { abbr: "LSB", col: 1, row: 5 },
  "15": { abbr: "STB", col: 2, row: 5 },
  "07": { abbr: "EVR", col: 3, row: 5 },
  "02": { abbr: "BJA", col: 3, row: 6 },
  "08": { abbr: "FAR", col: 2, row: 7 },
  EUR: { abbr: "EUR", col: 5, row: 1 },
  FEU: { abbr: "FEU", col: 5, row: 2 },
  "40": { abbr: "AÇO", col: 5, row: 4 },
  "30": { abbr: "MAD", col: 5, row: 5 },
};

/** Dark or light text, whichever reads better on the party colour. */
function textOn(hex: string | null): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "var(--ink)";
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.25 ? "#111111" : "#ffffff";
}

/** A square per electoral circle, coloured by who won it; pressing one shows its result beside the map. */
export function CircleTiles({ circles, initial }: { circles: CircleTile[]; initial: string }) {
  const [selected, setSelected] = useState(initial);
  const placed = circles.filter((circle) => GRID[circle.code]);
  const current = placed.find((circle) => circle.code === selected) ?? placed[0];
  if (!current) return null;

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,17rem)_1fr]">
      <div>
        <div role="group" aria-label="Círculos eleitorais" className="grid grid-cols-5 gap-1.5">
          {placed.map((circle) => {
            const place = GRID[circle.code]!;
            const active = circle.code === current.code;
            return (
              <button
                key={circle.code}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(circle.code)}
                style={{
                  gridColumn: place.col,
                  gridRow: place.row,
                  backgroundColor: circle.color ?? "var(--surface)",
                  color: textOn(circle.color),
                }}
                className={`flex aspect-square flex-col justify-between rounded-md p-1.5 text-left font-mono text-[10px] font-bold leading-none ${
                  active ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "hover:opacity-85"
                }`}
              >
                <span>
                  {place.abbr}
                  <span className="sr-only">
                    {" "}
                    {circle.name}
                    {circle.winner ? `: venceu ${circle.winner}` : ""}
                    {circle.mandates ? `, ${circle.mandates} mandatos` : ""}
                  </span>
                </span>
                <span aria-hidden="true" className="font-normal">
                  {circle.mandates ?? ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          Mapa esquemático: um quadrado por círculo, na posição aproximada. O número é o de mandatos a eleger.
        </p>
      </div>

      <section aria-live="polite" aria-label="Círculo selecionado" className="rounded-2xl border border-line p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Círculo selecionado</p>
        <h3 className="mt-1 text-2xl font-bold">{current.name}</h3>
        {current.mandates !== null && (
          <p className="mt-1 font-mono text-xs text-muted">
            {current.mandates} {current.mandates === 1 ? "mandato" : "mandatos"} a eleger
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {current.top.map((item) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
                <span className="flex items-center gap-1.5 font-bold">
                  <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span>
                  {item.pct}
                  {item.mandates ? ` · ${item.mandates} mand.` : ""}
                </span>
              </div>
              <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full" style={{ width: `${Math.min(item.share, 100)}%`, backgroundColor: item.color }} />
              </div>
            </li>
          ))}
        </ul>
        <Link
          href={current.href}
          className="mt-5 inline-block rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
        >
          {current.code === "EUR" || current.code === "FEU" ? `Ver resultados de ${current.name}` : `Ver concelhos de ${current.name}`}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { GovernmentMember } from "@/lib/types";
import { GovernmentPortrait } from "./GovernmentPortrait";

const RX = 43; // % of the width
const RY = 40; // % of the height
const ASPECT = 16 / 11.5;

/** Points around the table at equal distances, so the ends of the oval aren't crowded: angle for each share of the way round. */
const ARC = (() => {
  const steps = 720;
  const lengths = [0];
  for (let i = 1; i <= steps; i++) {
    const a = (2 * Math.PI * (i - 1)) / steps;
    const b = (2 * Math.PI * i) / steps;
    const dx = RX * ASPECT * (Math.cos(b) - Math.cos(a));
    const dy = RY * (Math.sin(b) - Math.sin(a));
    lengths.push(lengths[i - 1]! + Math.hypot(dx, dy));
  }
  const total = lengths[steps]!;
  return (share: number) => {
    const target = (((share % 1) + 1) % 1) * total;
    const i = lengths.findIndex((length) => length >= target);
    return (2 * Math.PI * Math.max(0, i)) / steps;
  };
})();

/** Where seat `index` of `count` sits around the table, in % of the box: the head at the top, then alternating right and left. */
function placeAt(index: number, count: number): { left: number; top: number } {
  const offset = index === 0 ? 0 : Math.ceil(index / 2) * (index % 2 === 1 ? 1 : -1);
  // The top of the oval is a quarter of the way round from its right end.
  const angle = ARC(0.75 + offset / count);
  // Rounded so server and browser write the same style.
  return { left: Math.round((50 + RX * Math.cos(angle)) * 100) / 100, top: Math.round((50 + RY * Math.sin(angle)) * 100) / 100 };
}

export type CouncilSeat = { member: GovernmentMember; ministry: string; secretaries: GovernmentMember[] };

type Props = {
  /** In protocol order: the Prime Minister first. */
  seats: CouncilSeat[];
  /** The member whose seat is lit. */
  chosen: string | null;
  onChoose: (id: string) => void;
};

/**
 * The Council of Ministers as a table seen from above: the Prime Minister at the head and the ministers around it
 * in protocol order, alternating right and left. The dots under each name are their secretaries of State. The
 * middle of the table names the ministry under the cursor.
 */
export function CouncilTable({ seats, chosen, onChoose }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (seats.length === 0) return null;

  const shown = seats.find((seat) => seat.member.id === (hovered ?? chosen));
  const ministers = seats.filter((seat) => seat.member.kind === "minister").length;
  const secretaries = seats.reduce((sum, seat) => sum + seat.secretaries.length, 0);

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="relative mx-auto aspect-[16/11.5] min-w-[40rem] max-w-5xl">
        {/* The table. */}
        <div className="absolute inset-x-[17%] inset-y-[21%] rounded-[50%] border border-line bg-surface shadow-[inset_0_2px_24px_rgb(0_0_0/0.18)]" />
        <div aria-hidden="true" className="absolute inset-x-[24%] inset-y-[30%] flex flex-col items-center justify-center text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted">{shown ? shown.ministry : "Conselho de Ministros"}</p>
          {shown ? (
            <>
              <p className="mt-1 text-lg font-bold leading-tight">{shown.member.name}</p>
              <p className="text-xs text-muted">
                {shown.secretaries.length === 0
                  ? "Sem secretários de Estado"
                  : shown.secretaries.length === 1
                    ? "1 secretário de Estado"
                    : `${shown.secretaries.length} secretários de Estado`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm">
              {seats[0]?.member.kind === "prime_minister" ? "O Primeiro-Ministro e " : ""}
              {ministers} ministros
              {secretaries > 0 && `, com ${secretaries} secretários de Estado`}.
            </p>
          )}
        </div>

        <ul aria-label="Lugares à mesa do Conselho de Ministros, por ordem protocolar">
          {seats.map((seat, index) => {
            const { left, top } = placeAt(index, seats.length);
            const id = seat.member.id;
            const head = seat.member.kind === "prime_minister";
            return (
              <li key={id} className="absolute w-24 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
                <button
                  type="button"
                  aria-pressed={chosen === id}
                  onClick={() => onChoose(id)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(id)}
                  onBlur={() => setHovered(null)}
                  className="group flex w-full flex-col items-center gap-1 rounded-lg p-1 motion-safe:animate-[seat-in_500ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span
                    className={`rounded-full p-0.5 transition ${
                      chosen === id
                        ? "ring-2 ring-ink"
                        : head
                          ? "ring-2 ring-line group-hover:ring-ink"
                          : "group-hover:ring-2 group-hover:ring-line"
                    }`}
                  >
                    <GovernmentPortrait name={seat.member.name} photoUrl={seat.member.photoUrl} size="md" />
                  </span>
                  <span className="line-clamp-2 text-[10.5px] font-bold leading-tight">{seat.member.name}</span>
                  <span className="sr-only">
                    , {seat.member.title}
                    {seat.secretaries.length > 0 && `, ${seat.secretaries.length} secretários de Estado`}
                  </span>
                  {seat.secretaries.length > 0 && (
                    <span aria-hidden="true" className="flex gap-0.5">
                      {seat.secretaries.map((secretary) => (
                        <span key={secretary.id} className="size-1.5 rounded-full bg-muted" />
                      ))}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

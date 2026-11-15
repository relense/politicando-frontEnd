"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { arrangeSeats, focusOf, neighbourSeat, polar, seatSpacing, type Direction } from "@/lib/hemicycle";
import { partyColor, SEAT_ORDER } from "@/lib/parliament";
import type { Parliament, ParliamentGroup, ParliamentSeat } from "@/lib/types";

type Props = {
  seatMap: Parliament["seatMap"];
  groups: ReadonlyMap<string, ParliamentGroup>;
  /** The seat of the chosen deputy, when the API knows it. */
  selectedSeat: number | null;
  /** Parties whose seats stand out; the rest are dimmed. Null shows every seat normally. */
  highlighted: ReadonlySet<string> | null;
  onSeat: (seat: ParliamentSeat) => void;
};

/** Server and browser can differ in the last digit of trigonometry, which breaks hydration; two decimals is plenty. */
const round = (value: number) => Math.round(value * 100) / 100;
const KEYS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "back", ArrowDown: "front" };

/**
 * The chamber as a seat map, like choosing a seat for a show, drawn from the official seating plan on the floor
 * of the hemicycle. Keyboard: one tab stop; arrows move along a row and between rows, Enter or Space opens the seat.
 */
export function Hemicycle({ seatMap, groups, selectedSeat, highlighted, onSeat }: Props) {
  const [tip, setTip] = useState<{ number: number; left: number; top: number } | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // A regular hemicycle in the official order; see arrangeSeats.
  const layout = useMemo(() => arrangeSeats(seatMap.seats, focusOf(seatMap), SEAT_ORDER), [seatMap]);
  const { seats } = layout;
  const focus = useMemo(() => focusOf(layout), [layout]);
  const spacing = useMemo(() => seatSpacing(seats), [seats]);
  const radii = useMemo(() => seats.map((seat) => polar(seat, focus).radius), [seats, focus]);

  const outer = round(Math.max(...radii) + spacing * 0.8);
  const inner = round(Math.min(...radii) - spacing * 0.8);
  const seatRadius = round(spacing * 0.38);
  const fx = round(focus.x);
  const fy = round(focus.y);
  // The floor: a half ring from behind the back row to just in front of the first row.
  const floor = `M ${fx - outer} ${fy} A ${outer} ${outer} 0 0 1 ${fx + outer} ${fy} L ${fx + inner} ${fy} A ${inner} ${inner} 0 0 0 ${fx - inner} ${fy} Z`;
  const mesaWidth = round(inner * 0.9);

  // On a phone the map is wider than the screen so seats stay big enough to press; start at the centre.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, []);

  const tabSeat = selectedSeat ?? focused ?? seats[0]?.number ?? null;

  /** Places the label over the seat as drawn. */
  function showTip(number: number, element: Element) {
    const box = container.current?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (!box) return;
    setTip({ number, left: rect.left + rect.width / 2 - box.left, top: rect.top - box.top });
  }

  function onKeyDown(event: KeyboardEvent, seat: ParliamentSeat) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSeat(seat);
      return;
    }
    const direction = KEYS[event.key];
    if (!direction) return;
    event.preventDefault();
    const next = neighbourSeat(seats, seat, direction, focus, spacing);
    if (!next) return;
    setFocused(next.number);
    document.getElementById(`lugar-${next.number}`)?.focus();
  }

  const describe = (seat: ParliamentSeat) => {
    const group = groups.get(seat.partySlug);
    return { acronym: group?.party.acronym ?? seat.group, name: group?.party.name ?? seat.group, seats: group?.seats };
  };
  const shown = tip ? seats.find((seat) => seat.number === tip.number) : undefined;

  return (
    <div ref={scroller} className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div ref={container} className="relative min-w-[40rem] sm:min-w-0">
        <svg
          viewBox={`${round(fx - outer - 4)} ${round(fy - outer - 4)} ${round(outer * 2 + 8)} ${round(outer + 8)}`}
          role="group"
          aria-label="Lugares do hemiciclo. Usa as setas para mudar de lugar e Enter para abrir a bancada."
          className="block h-auto w-full touch-manipulation select-none"
          onMouseLeave={() => setTip(null)}
        >
          <path d={floor} className="fill-surface stroke-line" strokeWidth={2} aria-hidden="true" />
          <g aria-hidden="true">
            <rect
              x={round(fx - mesaWidth / 2)}
              y={round(fy - 44)}
              width={mesaWidth}
              height={30}
              rx={6}
              className="fill-paper stroke-line"
              strokeWidth={1.5}
            />
            <text x={fx} y={round(fy - 24)} textAnchor="middle" className="fill-muted font-mono text-[12px] uppercase tracking-[0.2em]">
              Mesa
            </text>
          </g>

          {seats.map((seat) => {
            const { acronym, name } = describe(seat);
            const selected = seat.number === selectedSeat;
            const dimmed = highlighted !== null && !highlighted.has(seat.partySlug);
            const x = round(seat.x);
            const y = round(seat.y);
            return (
              <g
                key={seat.number}
                id={`lugar-${seat.number}`}
                role="button"
                aria-label={`Lugar ${seat.number}, ${name} (${acronym})`}
                aria-pressed={selected}
                tabIndex={seat.number === tabSeat ? 0 : -1}
                onClick={() => onSeat(seat)}
                onKeyDown={(event) => onKeyDown(event, seat)}
                onFocus={(event) => {
                  setFocused(seat.number);
                  showTip(seat.number, event.currentTarget);
                }}
                onBlur={() => {
                  setFocused((current) => (current === seat.number ? null : current));
                  setTip(null);
                }}
                onMouseEnter={(event) => showTip(seat.number, event.currentTarget)}
                className="cursor-pointer"
                style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 150ms" }}
              >
                {/* A generous invisible target, so small seats stay easy to press. */}
                <circle cx={x} cy={y} r={seatRadius * 1.35} fill="transparent" />
                {/* A soft shadow under each seat gives the floor some depth. */}
                <circle cx={x} cy={round(y + seatRadius * 0.3)} r={seatRadius} fill="black" opacity={dimmed ? 0 : 0.2} />
                {/* Dimmed seats turn grey rather than faint, which stays clear on the dark theme too. */}
                <circle
                  cx={x}
                  cy={y}
                  r={seatRadius}
                  fill={dimmed ? undefined : partyColor(seat.partySlug)}
                  className={dimmed ? "fill-muted" : undefined}
                />
                {selected && <circle cx={x} cy={y} r={round(seatRadius * 1.5)} fill="none" className="stroke-ink" strokeWidth={2} />}
              </g>
            );
          })}
        </svg>

        {shown && tip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 w-max max-w-60 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-md border border-line bg-paper px-2.5 py-1.5 font-mono text-xs shadow-lg"
            style={{ left: tip.left, top: tip.top }}
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(shown.partySlug) }} />
              <span className="font-bold">{describe(shown).name}</span>
              <span className="text-muted">· lugar {shown.number}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

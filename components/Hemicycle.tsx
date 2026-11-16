"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { arrangeSeats, focusOf, neighbourSeat, polar, seatSpacing, type Direction } from "@/lib/hemicycle";
import { partyColor, SEAT_ORDER } from "@/lib/parliament";
import { seatPhoto } from "@/lib/photos";
import type { DeputySummary, Parliament, ParliamentGroup, ParliamentSeat } from "@/lib/types";

type Props = {
  seatMap: Parliament["seatMap"];
  groups: ReadonlyMap<string, ParliamentGroup>;
  /** Deputies by id, to name whoever sits in a seat. */
  deputies: ReadonlyMap<number, DeputySummary>;
  /** The seat of the chosen deputy, when the API knows it. */
  selectedSeat: number | null;
  /** Parties whose seats stand out; the rest are dimmed. Null shows every seat normally. */
  highlighted: ReadonlySet<string> | null;
  onSeat: (seat: ParliamentSeat) => void;
};

/** Server and browser can differ in the last digit of trigonometry, which breaks hydration; two decimals is plenty. */
const round = (value: number) => Math.round(value * 100) / 100;
/** `key` is "lugar-N", the seat's element id. */
type Tip = { key: string; left: number; top: number; align: "start" | "middle" | "end"; below: boolean };
/** Room the label needs above a seat; on the top rows it opens below instead. */
const TIP_HEIGHT = 80;
const TIP_SHIFT = { start: "-16px", middle: "-50%", end: "calc(-100% + 16px)" } as const;
const KEYS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "back", ArrowDown: "front" };

/**
 * The chamber as a seat map, like choosing a seat for a show, drawn from the official seating plan on the floor
 * of the hemicycle. Keyboard: one tab stop; arrows move along a row and between rows, Enter or Space opens the seat.
 */
export function Hemicycle({ seatMap, groups, deputies, selectedSeat, highlighted, onSeat }: Props) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // A regular hemicycle in the official order; see arrangeSeats.
  const layout = useMemo(() => arrangeSeats(seatMap.seats, focusOf(seatMap), SEAT_ORDER), [seatMap]);
  const { seats } = layout;
  const focus = useMemo(() => focusOf(layout), [layout]);
  const spacing = useMemo(() => seatSpacing(seats), [seats]);
  const radii = useMemo(() => seats.map((seat) => polar(seat, focus).radius), [seats, focus]);

  // Each seat's face, front rows first so the closest faces appear first.
  const photos = useMemo(() => {
    const byRow = seats.map((seat, index) => ({ seat, radius: radii[index]! })).sort((a, b) => a.radius - b.radius);
    const list: [string, string][] = [];
    for (const { seat } of byRow) {
      const deputy = seat.deputyId !== null ? deputies.get(seat.deputyId) : undefined;
      const url = deputy ? seatPhoto(deputy) : null;
      if (url) list.push([`lugar-${seat.number}`, url]);
    }
    return list;
  }, [seats, radii, deputies]);
  const loaded = useLoadedPhotos(photos);

  const outer = round(Math.max(...radii) + spacing * 0.8);
  const inner = round(Math.min(...radii) - spacing * 0.8);
  // Big enough to recognise a face; the closest pair of seats still keeps a small gap.
  const seatRadius = round(spacing * 0.44);
  const fx = round(focus.x);
  const fy = round(focus.y);
  // The floor: a half ring from behind the back row to just in front of the first row.
  const floor = `M ${fx - outer} ${fy} A ${outer} ${outer} 0 0 1 ${fx + outer} ${fy} L ${fx + inner} ${fy} A ${inner} ${inner} 0 0 0 ${fx - inner} ${fy} Z`;
  const mesaWidth = round(inner * 0.9);
  const mesaTop = 44;

  // On a phone the map is wider than the screen so seats stay big enough to press; start at the centre.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, []);

  const tabSeat = selectedSeat ?? focused ?? seats[0]?.number ?? null;

  /**
   * Places the label by the seat as drawn, opening away from the nearest edge (and below the seat on the top
   * rows) so it never spills out of the map and makes the page scroll.
   */
  function showTip(key: string, element: Element) {
    const box = container.current?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (!box) return;
    const centre = rect.left + rect.width / 2 - box.left;
    const share = centre / box.width;
    const below = rect.top - box.top < TIP_HEIGHT;
    setTip({
      key,
      left: centre,
      top: below ? rect.bottom - box.top + 6 : rect.top - box.top - 6,
      align: share < 0.3 ? "start" : share > 0.7 ? "end" : "middle",
      below,
    });
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
    // Rows are judged by the gap between them, since seats in a busy row sit a little forward or back.
    const next = neighbourSeat(seats, seat, direction, focus, layout.rowGap);
    if (!next) return;
    setFocused(next.number);
    document.getElementById(`lugar-${next.number}`)?.focus();
  }

  const describe = (seat: ParliamentSeat) => {
    const group = groups.get(seat.partySlug);
    const deputy = seat.deputyId !== null ? deputies.get(seat.deputyId) : undefined;
    return { acronym: group?.party.acronym ?? seat.group, name: group?.party.name ?? seat.group, deputy };
  };
  const shown = tip ? seats.find((seat) => `lugar-${seat.number}` === tip.key) : undefined;

  return (
    // The label sits outside the scrolling area, so it can never add a scrollbar of its own.
    <div ref={container} className="relative">
      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="min-w-[40rem] sm:min-w-0">
          <svg
            viewBox={`${round(fx - outer - 4)} ${round(fy - outer - 4)} ${round(outer * 2 + 8)} ${round(outer + 8)}`}
            role="group"
            aria-label="Lugares do hemiciclo. Usa as setas para mudar de lugar e Enter para abrir o deputado."
            className="block h-auto w-full touch-manipulation select-none"
            onMouseLeave={() => setTip(null)}
          >
            <defs>
              {/* One round crop, sized to each photo's own box. */}
              <clipPath id="lugar-recorte" clipPathUnits="objectBoundingBox">
                <circle cx={0.5} cy={0.5} r={0.5} />
              </clipPath>
            </defs>
            <path d={floor} className="fill-surface stroke-line" strokeWidth={2} aria-hidden="true" />
            <g aria-hidden="true">
              <rect
                x={round(fx - mesaWidth / 2)}
                y={round(fy - mesaTop)}
                width={mesaWidth}
                height={round(mesaTop - 12)}
                rx={6}
                className="fill-paper stroke-line"
                strokeWidth={1.5}
              />
              <text
                x={fx}
                y={round(fy - 12 - (mesaTop - 12) / 2 + 4)}
                textAnchor="middle"
                className="fill-muted font-mono text-[12px] uppercase tracking-[0.2em]"
              >
                Mesa
              </text>
            </g>

            {seats.map((seat) => {
              const { acronym, name, deputy } = describe(seat);
              const selected = seat.number === selectedSeat;
              const dimmed = highlighted !== null && !highlighted.has(seat.partySlug);
              const x = round(seat.x);
              const y = round(seat.y);
              const photo = loaded.get(`lugar-${seat.number}`);
              return (
                <g
                  key={seat.number}
                  id={`lugar-${seat.number}`}
                  role="button"
                  aria-label={`Lugar ${seat.number}, ${deputy ? `${deputy.name}, ` : ""}${name} (${acronym})`}
                  aria-pressed={selected}
                  tabIndex={seat.number === tabSeat ? 0 : -1}
                  onClick={() => onSeat(seat)}
                  onKeyDown={(event) => onKeyDown(event, seat)}
                  onFocus={(event) => {
                    setFocused(seat.number);
                    showTip(`lugar-${seat.number}`, event.currentTarget);
                  }}
                  onBlur={() => {
                    setFocused((current) => (current === seat.number ? null : current));
                    setTip(null);
                  }}
                  onMouseEnter={(event) => showTip(`lugar-${seat.number}`, event.currentTarget)}
                  className="cursor-pointer"
                  style={{ opacity: dimmed ? 0.35 : 1, filter: dimmed ? "grayscale(1)" : undefined, transition: "opacity 150ms" }}
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
                  {/* The face, once loaded, with a ring in the party's colour so the sectors still read. */}
                  {photo && (
                    <>
                      <image
                        href={photo}
                        x={round(x - seatRadius)}
                        y={round(y - seatRadius)}
                        width={round(seatRadius * 2)}
                        height={round(seatRadius * 2)}
                        preserveAspectRatio="xMidYMin slice"
                        clipPath="url(#lugar-recorte)"
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={round(seatRadius - 1.25)}
                        fill="none"
                        stroke={dimmed ? undefined : partyColor(seat.partySlug)}
                        className={dimmed ? "stroke-muted" : undefined}
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                  {selected && <circle cx={x} cy={y} r={round(seatRadius * 1.5)} fill="none" className="stroke-ink" strokeWidth={2} />}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {shown && tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 w-max max-w-72 rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tip.left, top: tip.top, transform: `translate(${TIP_SHIFT[tip.align]}, ${tip.below ? "0" : "-100%"})` }}
        >
          <TipContent seat={shown} {...describe(shown)} />
        </div>
      )}
    </div>
  );
}

/** The deputy in the seat when known (name, party, main post), otherwise the party. Estimated seats say so. */
function TipContent({ seat, acronym, name, deputy }: { seat: ParliamentSeat; acronym: string; name: string; deputy?: DeputySummary }) {
  const dot = <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: partyColor(seat.partySlug) }} />;
  if (!deputy) {
    return (
      <span className="flex items-center gap-1.5 font-mono">
        {dot}
        <span className="font-bold">{name}</span>
        <span className="text-muted">· lugar {seat.number}</span>
      </span>
    );
  }
  const post = deputy.role ?? deputy.positions[0];
  return (
    <span className="block">
      <span className="flex items-center gap-1.5 text-sm font-bold leading-snug">
        {dot}
        {deputy.name}
      </span>
      <span className="block font-mono text-muted">
        {acronym} · {deputy.constituency} · lugar {seat.number}
        {seat.estimated && " (aproximado)"}
      </span>
      {post && <span className="mt-0.5 block truncate font-mono text-ink">{post}</span>}
    </span>
  );
}

/** How many photos load at once, so the map never ties up every connection to the server. */
const PARALLEL_PHOTOS = 6;

/**
 * Loads the seats' photos a few at a time, in the order given, and returns those that arrived (key → url).
 * Seats keep their party colour until then, and if a photo fails.
 */
function useLoadedPhotos(photos: readonly [string, string][]): ReadonlyMap<string, string> {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    let next = 0;
    const done = new Map<string, string>();
    const start = () => {
      if (cancelled || next >= photos.length) return;
      const [seat, url] = photos[next++]!;
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        done.set(seat, url);
        setLoaded(new Map(done));
        start();
      };
      image.onerror = start;
      image.src = url;
    };
    for (let i = 0; i < PARALLEL_PHOTOS; i++) start();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  return loaded;
}

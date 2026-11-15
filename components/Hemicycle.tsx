"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { arrangeSeats, focusOf, governmentBench, neighbourSeat, polar, seatSpacing, type Direction } from "@/lib/hemicycle";
import { partyColor, SEAT_ORDER } from "@/lib/parliament";
import { governmentPhoto, seatPhoto } from "@/lib/photos";
import type { DeputySummary, GovernmentMember, Parliament, ParliamentGroup, ParliamentSeat } from "@/lib/types";

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
  /** The Prime Minister and the ministers, in protocol order, for the Government's bench. Empty draws none. */
  government?: readonly GovernmentMember[];
};

/** Server and browser can differ in the last digit of trigonometry, which breaks hydration; two decimals is plenty. */
const round = (value: number) => Math.round(value * 100) / 100;
/** `key` is "lugar-N" for a deputy's seat or "governo-ID" for the Government's bench. */
type Tip = { key: string; left: number; top: number; align: "start" | "middle" | "end"; below: boolean };
/** Room the label needs above a seat; on the top rows it opens below instead. */
const TIP_HEIGHT = 80;
const TIP_SHIFT = { start: "-16px", middle: "-50%", end: "calc(-100% + 16px)" } as const;
const KEYS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "back", ArrowDown: "front" };

/**
 * The chamber as a seat map, like choosing a seat for a show, drawn from the official seating plan on the floor
 * of the hemicycle. Keyboard: one tab stop; arrows move along a row and between rows, Enter or Space opens the seat.
 */
export function Hemicycle({ seatMap, groups, deputies, selectedSeat, highlighted, onSeat, government = [] }: Props) {
  const router = useRouter();
  const [tip, setTip] = useState<Tip | null>(null);
  const [focusedMember, setFocusedMember] = useState(0);
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
    // The Government's few faces first: they sit at the front.
    for (const member of government) {
      const url = governmentPhoto(member.photoUrl, 32);
      if (url) list.push([`governo-${member.id}`, url]);
    }
    for (const { seat } of byRow) {
      const deputy = seat.deputyId !== null ? deputies.get(seat.deputyId) : undefined;
      const url = deputy ? seatPhoto(deputy) : null;
      if (url) list.push([`lugar-${seat.number}`, url]);
    }
    return list;
  }, [seats, radii, deputies, government]);
  const loaded = useLoadedPhotos(photos);

  const outer = round(Math.max(...radii) + spacing * 0.8);
  const inner = round(Math.min(...radii) - spacing * 0.8);
  const seatRadius = round(spacing * 0.38);
  const fx = round(focus.x);
  const fy = round(focus.y);
  // The floor: a half ring from behind the back row to just in front of the first row.
  const floor = `M ${fx - outer} ${fy} A ${outer} ${outer} 0 0 1 ${fx + outer} ${fy} L ${fx + inner} ${fy} A ${inner} ${inner} 0 0 0 ${fx - inner} ${fy} Z`;
  // A smaller Mesa leaves room for the Government's bench in front of it.
  const mesaWidth = round(government.length > 0 ? inner * 0.62 : inner * 0.9);
  const mesaTop = government.length > 0 ? 32 : 44;
  const benchRadius = round(seatRadius * 0.82);
  const bench = useMemo(
    () =>
      governmentBench(government.length, {
        front: inner - benchRadius * 1.6,
        step: benchRadius * 2.25,
        clear: mesaTop + benchRadius,
        mesaHalfWidth: mesaWidth / 2,
      }).map((place) => ({ x: round(fx + place.x), y: round(fy + place.y) })),
    [government.length, inner, benchRadius, mesaTop, mesaWidth, fx, fy],
  );
  // The bench's arcs, drawn as a desk behind its seats.
  const benchArcs = [...new Set(bench.map((place) => round(Math.hypot(place.x - fx, place.y - fy))))];

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
    const next = neighbourSeat(seats, seat, direction, focus, spacing);
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
  const shownMember = tip ? government.find((member) => `governo-${member.id}` === tip.key) : undefined;

  // The bench is one tab stop too: arrows move along it in drawing order, Enter opens the member's page.
  const benchOrder = bench.map((place, index) => ({ index, x: place.x, y: place.y })).sort((a, b) => a.x - b.x);
  function onBenchKey(event: KeyboardEvent, index: number) {
    const position = benchOrder.findIndex((item) => item.index === index);
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (move === 0) return;
    event.preventDefault();
    const next = benchOrder[position + move];
    if (!next) return;
    setFocusedMember(next.index);
    document.getElementById(`governo-${government[next.index]!.id}`)?.focus();
  }

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
              <clipPath id="governo-recorte" clipPathUnits="objectBoundingBox">
                <rect width={1} height={1} rx={0.25} />
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
                className={`fill-muted font-mono uppercase tracking-[0.2em] ${government.length > 0 ? "text-[10px]" : "text-[12px]"}`}
              >
                Mesa
              </text>
            </g>

            {bench.length > 0 && (
              <g
                role="group"
                aria-label="Bancada do Governo: o Primeiro-Ministro e os ministros. Não são deputados. Usa as setas para mudar e Enter para abrir."
                style={{ opacity: highlighted !== null ? 0.45 : 1, transition: "opacity 150ms" }}
              >
                {/* The desk: the bench's arcs in the Government's colour, so it never reads as one more party. */}
                <g aria-hidden="true">
                  {benchArcs.map((radius) => (
                    <path
                      key={radius}
                      d={`M ${round(fx - radius)} ${fy} A ${radius} ${radius} 0 0 1 ${round(fx + radius)} ${fy}`}
                      fill="none"
                      className="stroke-ink"
                      strokeOpacity={0.12}
                      strokeWidth={round(benchRadius * 2.5)}
                      strokeDasharray={`0 ${round(radius * 0.18)} ${round(radius * Math.PI - radius * 0.36)} ${round(radius * 0.18)}`}
                      strokeLinecap="round"
                    />
                  ))}
                </g>
                {bench.map((place, index) => {
                  const member = government[index]!;
                  const key = `governo-${member.id}`;
                  const photo = loaded.get(key);
                  const size = benchRadius * 2;
                  return (
                    <a
                      key={member.id}
                      id={key}
                      href={`/governo/${member.id}`}
                      aria-label={`${member.title}, ${member.name} (Governo)`}
                      tabIndex={index === focusedMember ? 0 : -1}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                        event.preventDefault();
                        router.push(`/governo/${member.id}`);
                      }}
                      onKeyDown={(event) => onBenchKey(event, index)}
                      onFocus={(event) => {
                        setFocusedMember(index);
                        showTip(key, event.currentTarget);
                      }}
                      onBlur={() => setTip(null)}
                      onMouseEnter={(event) => showTip(key, event.currentTarget)}
                      className="cursor-pointer outline-none motion-safe:animate-[seat-in_500ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                      style={{ animationDelay: `${300 + index * 70}ms`, transformBox: "fill-box", transformOrigin: "center" }}
                    >
                      <rect
                        x={round(place.x - size * 0.68)}
                        y={round(place.y - size * 0.68)}
                        width={round(size * 1.36)}
                        height={round(size * 1.36)}
                        fill="transparent"
                      />
                      {/* Square seats in the Government's colour: the bench is not a party sector. */}
                      <rect
                        x={round(place.x - size / 2)}
                        y={round(place.y - size / 2)}
                        width={round(size)}
                        height={round(size)}
                        rx={round(size * 0.28)}
                        className="fill-ink"
                      />
                      {photo && (
                        <image
                          href={photo}
                          x={round(place.x - size / 2 + 1.5)}
                          y={round(place.y - size / 2 + 1.5)}
                          width={round(size - 3)}
                          height={round(size - 3)}
                          preserveAspectRatio="xMidYMin slice"
                          clipPath="url(#governo-recorte)"
                        />
                      )}
                      {member.kind === "prime_minister" && (
                        <rect
                          x={round(place.x - size / 2 - 3)}
                          y={round(place.y - size / 2 - 3)}
                          width={round(size + 6)}
                          height={round(size + 6)}
                          rx={round(size * 0.34)}
                          fill="none"
                          className="stroke-ink"
                          strokeWidth={1.5}
                        />
                      )}
                    </a>
                  );
                })}
                <text
                  x={fx}
                  y={round(fy - mesaTop - 6)}
                  textAnchor="middle"
                  aria-hidden="true"
                  className="fill-muted font-mono text-[9px] font-bold uppercase tracking-[0.25em]"
                >
                  Governo
                </text>
              </g>
            )}

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
      {shownMember && tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 w-max max-w-72 rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tip.left, top: tip.top, transform: `translate(${TIP_SHIFT[tip.align]}, ${tip.below ? "0" : "-100%"})` }}
        >
          <MemberTip member={shownMember} party={shownMember.partySlug ? groups.get(shownMember.partySlug) : undefined} />
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

/** Someone on the Government's bench: who, what post, and that they are not a deputy. */
function MemberTip({ member, party }: { member: GovernmentMember; party?: ParliamentGroup }) {
  const elected = member.gender === "F" ? "eleita deputada" : "eleito deputado";
  return (
    <span className="block">
      <span className="block text-sm font-bold leading-snug">{member.name}</span>
      <span className="block font-mono text-ink">{member.title}</span>
      <span className="mt-0.5 block font-mono text-muted">
        Governo · {party ? `${elected} pelo ${party.party.acronym}, com o mandato suspenso` : "não é deputado"}
      </span>
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

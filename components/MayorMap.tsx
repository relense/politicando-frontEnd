"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { ApiError, locatePlace } from "@/lib/api/client";
import { getPlaceDetail } from "@/lib/api/places";
import { fold } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import type { PlaceMap } from "@/lib/maps";
import type { LegendItem } from "@/lib/places";

export type MayorMapPlace = {
  key: string;
  code: string;
  name: string;
  href: string;
  /** The district's name, for a municipality. */
  district: string | null;
  color: string | null;
  /** The legend entry it counts under: the main party's slug, or "independentes". */
  group: string | null;
  /** "PS", "PSD/CDS-PP", or a citizens' list's name. */
  listLabel: string | null;
  mayor: string | null;
  /** For a district: its câmaras by party, biggest first. */
  breakdown?: LegendItem[];
};

/** Something to find: a municipality or a district, by its name or its mayor's. */
export type SearchItem = {
  key: string;
  name: string;
  kind: "municipality" | "district";
  district: string | null;
  mayor: string | null;
  color: string | null;
};

type Box = { x: number; y: number; w: number; h: number };

/** The places people look for most, offered as one press. */
const POPULAR = ["Lisboa", "Porto", "Braga", "Coimbra", "Faro", "Setúbal"];

const parseBox = (viewBox: string): Box => {
  const [x, y, w, h] = viewBox.split(" ").map(Number);
  return { x: x!, y: y!, w: w!, h: h! };
};
const MAX_ZOOM = 12;
const initials = (name: string) => {
  const parts = name.split(/\s+/).filter((part) => part.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(part));
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)![0] : ""}`.toUpperCase();
};

/**
 * The map of who runs each câmara, made for finding your own: zoom with the buttons, a pinch or Ctrl and the wheel,
 * drag to move, the islands one press away. Pressing a place opens its card beside the map instead of leaving the
 * page; the legend lights one party. The list of every municipality below the map says the same in words.
 */
export function MayorMap({
  map,
  places,
  level,
  legend,
  total,
  initialKey,
  label,
  caption,
  searchItems,
  views,
}: {
  map: PlaceMap;
  places: MayorMapPlace[];
  level: "municipality" | "district";
  legend: LegendItem[];
  total: number;
  initialKey: string | null;
  label: string;
  caption: string;
  searchItems: SearchItem[];
  /** The two ways to colour the map, as links. */
  views: { href: string; label: string; current: boolean }[];
}) {
  /** The whole drawing, islands included: the furthest one can zoom out or move. */
  const full = useMemo(() => parseBox(map.viewBox), [map.viewBox]);
  /** Where the map starts and goes back to: the mainland, with the islands one press away instead of beside it. */
  const home = useMemo(() => {
    const right = Math.max(...map.insets.map((frame) => frame[2]!), -Infinity);
    if (!Number.isFinite(right) || right <= full.x) return full;
    const x = right + 12;
    return { x, y: full.y, w: full.x + full.w - x, h: full.h };
  }, [full, map.insets]);
  const [view, setView] = useState<Box>(home);
  const [selected, setSelected] = useState<string | null>(() => (places.some((place) => place.key === initialKey) ? initialKey : null));
  const [party, setParty] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const cardRef = useRef<HTMLDivElement>(null);
  const animation = useRef<number | null>(null);
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);
  const router = useRouter();

  const byCode = useMemo(() => new Map(places.map((place) => [place.code, place])), [places]);
  const byKey = useMemo(() => new Map(places.map((place) => [place.key, place])), [places]);
  const current = selected ? (byKey.get(selected) ?? null) : null;
  const zoom = home.w / view.w;
  const atHome = Math.abs(view.x - home.x) < 1 && Math.abs(view.y - home.y) < 1 && Math.abs(view.w - home.w) < 1;

  /** No closer than MAX_ZOOM, no further than the whole drawing, and its centre always on the drawing. */
  const clamp = useCallback(
    (target: Box): Box => {
      let { w, h } = target;
      const least = home.w / MAX_ZOOM;
      if (w < least) [w, h] = [least, (h * least) / w];
      const most = Math.max(full.w / w, full.h / h);
      if (most < 1) [w, h] = [w * most, h * most];
      const cx = Math.min(Math.max(target.x + target.w / 2, full.x), full.x + full.w);
      const cy = Math.min(Math.max(target.y + target.h / 2, full.y), full.y + full.h);
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    },
    [full, home.w],
  );

  /** Glides to a view, kept within the drawing. */
  const animateTo = useCallback(
    (target: Box) => {
      const end = clamp(target);
      if (animation.current) cancelAnimationFrame(animation.current);
      const start = viewRef.current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const began = performance.now();
      const step = (now: number) => {
        const t = reduced ? 1 : Math.min(1, (now - began) / 350);
        const ease = 1 - (1 - t) ** 3;
        setView({
          x: start.x + (end.x - start.x) * ease,
          y: start.y + (end.y - start.y) * ease,
          w: start.w + (end.w - start.w) * ease,
          h: start.h + (end.h - start.h) * ease,
        });
        animation.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animation.current = requestAnimationFrame(step);
    },
    [clamp],
  );

  const zoomBy = (factor: number, center?: { x: number; y: number }) => {
    const now = viewRef.current;
    const c = center ?? { x: now.x + now.w / 2, y: now.y + now.h / 2 };
    const w = now.w / factor;
    const h = now.h / factor;
    animateTo({ x: c.x - (c.x - now.x) / factor, y: c.y - (c.y - now.y) / factor, w, h });
  };

  /** Frames one place, with room around it. */
  const focus = useCallback(
    (key: string) => {
      const place = byKey.get(key);
      const path = place ? pathRefs.current.get(place.code) : undefined;
      if (!path) return;
      const box = path.getBBox();
      // Room around it, and never closer than a sixth of the country, so its neighbours stay in view.
      const side = Math.max(Math.max(box.width, box.height) * (level === "district" ? 1.6 : 3), home.h / 6);
      animateTo({ x: box.x + box.width / 2 - side / 2, y: box.y + box.height / 2 - side / 2, w: side, h: side });
    },
    [animateTo, byKey, level, home.h],
  );

  /** Lights one party (or none): the rest fade, its places are outlined and framed together. */
  function light(key: string | null) {
    setParty(key);
    if (!key) return animateTo(home);
    // The card then lists the party's places instead of one place.
    if (selected) choose(null);
    const boxes = places
      .filter((place) => place.group === key)
      .flatMap((place) => {
        const path = pathRefs.current.get(place.code);
        return path ? [path.getBBox()] : [];
      });
    if (boxes.length === 0) return;
    const x0 = Math.min(...boxes.map((box) => box.x));
    const y0 = Math.min(...boxes.map((box) => box.y));
    const x1 = Math.max(...boxes.map((box) => box.x + box.width));
    const y1 = Math.max(...boxes.map((box) => box.y + box.height));
    // Room around them, and never closer than a sixth of the country.
    const side = Math.max(x1 - x0, y1 - y0) * 1.25;
    const w = Math.max(side, home.h / 6);
    animateTo({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w / 2, w, h: w });
  }

  function choose(key: string | null, { zoomIn = false } = {}) {
    setSelected(key);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("local", key);
    else url.searchParams.delete("local");
    window.history.replaceState(window.history.state, "", url);
    if (key && zoomIn) focus(key);
    // Below the map on a phone: bring the card into view, after the render that fills it.
    if (key && !window.matchMedia("(min-width: 1280px)").matches) {
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }

  // The place in the address is framed once the shapes are drawn.
  useEffect(() => {
    if (selected) focus(selected);
    // Only on the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => void (animation.current && cancelAnimationFrame(animation.current)), []);

  // --- Pointer: drag to move, two fingers to pinch. A drag is never a press. ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; distance: number | null }>({ moved: false, distance: null });

  const toMap = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const now = viewRef.current;
    // preserveAspectRatio "meet": the drawing is centred with bands on the long side.
    const scale = Math.min(rect.width / now.w, rect.height / now.h);
    const offsetX = (rect.width - now.w * scale) / 2;
    const offsetY = (rect.height - now.h * scale) / 2;
    return { x: now.x + (clientX - rect.left - offsetX) / scale, y: now.y + (clientY - rect.top - offsetY) / scale, scale };
  };

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = { moved: false, distance: null };
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    const points = [...pointers.current.values()];
    if (points.length === 2) {
      const other = points.find((point) => point !== last)!;
      const distance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (gesture.current.distance) {
        const factor = distance / gesture.current.distance;
        const centre = toMap((event.clientX + other.x) / 2, (event.clientY + other.y) / 2);
        const now = viewRef.current;
        setView(
          clamp({
            x: centre.x - (centre.x - now.x) / factor,
            y: centre.y - (centre.y - now.y) / factor,
            w: now.w / factor,
            h: now.h / factor,
          }),
        );
      }
      gesture.current = { moved: true, distance };
    } else {
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      if (!gesture.current.moved && Math.hypot(dx, dy) < 4) return;
      if (!gesture.current.moved) svgRef.current?.setPointerCapture(event.pointerId);
      gesture.current.moved = true;
      const { scale } = toMap(event.clientX, event.clientY);
      setView((now) => ({ ...now, x: now.x - dx / scale, y: now.y - dy / scale }));
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current.distance = null;
  }

  // A trackpad pinch arrives as the wheel with Ctrl; the wheel alone keeps scrolling the page.
  function onWheel(event: WheelEvent<SVGSVGElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const point = toMap(event.clientX, event.clientY);
    zoomBy(event.deltaY < 0 ? 1.25 : 0.8, point);
  }

  // React's wheel listener is passive; this one may stop the page from zooming instead.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const stop = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    svg.addEventListener("wheel", stop, { passive: false });
    return () => svg.removeEventListener("wheel", stop);
  }, []);

  /** From the search: on this map it is framed and opened; otherwise its own map opens on it. */
  function find(item: SearchItem) {
    if (byKey.has(item.key)) {
      choose(item.key, { zoomIn: true });
      svgRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else router.push(item.kind === "district" ? `/sitios?mapa=distritos&local=${item.key}` : `/sitios?local=${item.key}`);
  }

  function press(place: MayorMapPlace) {
    if (gesture.current.moved) return;
    choose(selected === place.key ? null : place.key);
  }

  function onShapeKey(event: KeyboardEvent<SVGPathElement>, place: MayorMapPlace) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(place.key, { zoomIn: true });
    }
  }

  // The islands, from the drawing's inset frames (the Azores first, then Madeira).
  const islands = [
    { name: "Açores", frame: map.insets[0], prefix: "4" },
    { name: "Madeira", frame: map.insets[1], prefix: "3" },
  ].flatMap((island) =>
    island.frame ? [{ ...island, count: places.filter((place) => place.code.startsWith(island.prefix)).length }] : [],
  );
  const unit = level === "district" ? ["distrito", "distritos"] : ["concelho", "concelhos"];
  const top = legend[0]?.count ?? 1;
  const hoveredPlace = hovered ? byCode.get(hovered) : null;

  const popular = POPULAR.flatMap((name) => searchItems.filter((item) => item.kind === "municipality" && item.name === name).slice(0, 1));

  return (
    <>
      <PlaceSearch items={searchItems} popular={popular} onFind={find} />

      <section aria-labelledby="mapa" className="mb-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-2">
          <h2 id="mapa" className="font-mono text-sm font-bold uppercase tracking-widest">
            Presidentes de câmara por partido
          </h2>
          <nav aria-label="Ver o mapa por" className="flex rounded-lg border border-line p-0.5">
            {views.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                aria-current={item.current ? "page" : undefined}
                className={`rounded-md px-3 py-1 font-mono text-xs font-bold ${item.current ? "bg-ink text-paper" : "hover:bg-surface"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_20rem]">
          <div className="order-3 lg:order-none">
            <p className="mb-3 text-xs text-muted">Toca num partido para o destacar no mapa</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 lg:block lg:space-y-1">
              {legend.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={party === item.key}
                    onClick={() => light(party === item.key ? null : item.key)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left font-mono text-xs ${party === item.key ? "bg-surface" : "hover:bg-surface"} ${
                      party && party !== item.key ? "opacity-50" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="min-w-0 flex-1 truncate font-bold">{item.label}</span>
                      <span>
                        {item.count}
                        <span className="sr-only"> de {total} câmaras</span>
                      </span>
                    </span>
                    <span aria-hidden="true" className="mt-1 block h-1 overflow-hidden rounded-full bg-surface">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(item.count / top) * 100}%`, backgroundColor: item.color }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[11px] text-muted">De {total} câmaras. Independentes: listas de grupos de cidadãos.</p>
          </div>

          <figure className="order-1 min-w-0 lg:order-none">
            <div className="relative h-[min(75vh,44rem)] min-h-[24rem] overflow-hidden rounded-2xl border border-line">
              <svg
                ref={svgRef}
                viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                role="group"
                aria-label={label}
                className={`block size-full touch-none select-none ${zoom > 1.01 ? "cursor-grab active:cursor-grabbing" : ""}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={onWheel}
                onDoubleClick={(event) => zoomBy(2, toMap(event.clientX, event.clientY))}
              >
                {/* A lit party's shapes are drawn last, so their outline is never hidden under a neighbour's. */}
                {(party
                  ? [...map.shapes].sort(
                      (a, b) => Number(byCode.get(a.code)?.group === party) - Number(byCode.get(b.code)?.group === party),
                    )
                  : map.shapes
                ).map((shape) => {
                  const place = byCode.get(shape.code);
                  if (!place) return null;
                  const dim = party !== null && place.group !== party;
                  const lit = party !== null && !dim;
                  const active = place.key === selected;
                  const text = place.mayor
                    ? `${place.name}: ${place.mayor}, ${place.listLabel ?? "independente"}`
                    : place.listLabel
                      ? `${place.name}: ${place.listLabel}`
                      : place.name;
                  return (
                    <path
                      key={shape.code}
                      ref={(element) => {
                        if (element) pathRefs.current.set(shape.code, element);
                        else pathRefs.current.delete(shape.code);
                      }}
                      d={shape.d}
                      role="button"
                      tabIndex={0}
                      aria-label={text}
                      aria-pressed={active}
                      fill={place.color ?? "var(--line)"}
                      fillOpacity={dim ? 0.07 : active || lit || hovered === shape.code ? 1 : 0.88}
                      className={`cursor-pointer outline-none transition-[fill-opacity] focus-visible:stroke-ink focus-visible:[stroke-width:3] ${
                        active || lit ? "stroke-ink" : "stroke-paper"
                      }`}
                      strokeWidth={active ? 2.5 : lit ? 1.6 : 0.8}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      onClick={() => press(place)}
                      onKeyDown={(event) => onShapeKey(event, place)}
                      onPointerEnter={() => setHovered(shape.code)}
                      onPointerLeave={() => setHovered((now) => (now === shape.code ? null : now))}
                    >
                      <title>{text}</title>
                    </path>
                  );
                })}
              </svg>

              {/* The islands, one press away. */}
              {islands.length > 0 && (
                <div className="absolute left-3 top-3 flex flex-col gap-2">
                  {islands.map((island) => (
                    <button
                      key={island.name}
                      type="button"
                      onClick={() => {
                        const [x0, y0, x1, y1] = island.frame!;
                        animateTo({ x: x0! - 10, y: y0! - 10, w: x1! - x0! + 20, h: y1! - y0! + 20 });
                      }}
                      className="rounded-xl border border-line bg-paper/90 px-3 py-2 text-left shadow-sm backdrop-blur hover:bg-surface"
                    >
                      <span className="block font-mono text-[10px] uppercase tracking-widest text-muted">Ilhas</span>
                      <span className="block text-sm font-bold leading-tight">{island.name}</span>
                      <span className="block font-mono text-[10px] text-muted">
                        {island.count} {island.count === 1 ? unit[0] : unit[1]} →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* What is under the pointer, without pressing. */}
              {hoveredPlace && (
                <p
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] rounded-lg border border-line bg-paper/95 px-3 py-1.5 text-sm shadow-sm"
                >
                  <span className="font-bold">{hoveredPlace.name}</span>
                  {hoveredPlace.listLabel && (
                    <span className="ml-2 inline-flex items-center gap-1 font-mono text-xs text-muted">
                      <span className="size-2 rounded-full" style={{ backgroundColor: hoveredPlace.color ?? "var(--line)" }} />
                      {hoveredPlace.listLabel}
                    </span>
                  )}
                </p>
              )}

              <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
                {[
                  { label: "Aproximar", icon: "M10 4v12M4 10h12", act: "in", disabled: zoom >= MAX_ZOOM - 0.01 },
                  { label: "Afastar", icon: "M4 10h12", act: "out", disabled: view.w >= full.w - 1 && view.h >= full.h - 1 },
                  { label: "Ver o continente inteiro", icon: "M4 8V4h4M12 4h4v4M16 12v4h-4M8 16H4v-4", act: "home", disabled: atHome },
                ].map((button) => (
                  <button
                    key={button.label}
                    type="button"
                    aria-label={button.label}
                    title={button.label}
                    onClick={() => (button.act === "in" ? zoomBy(1.6) : button.act === "out" ? zoomBy(1 / 1.6) : animateTo(home))}
                    disabled={button.disabled}
                    className="flex size-9 items-center justify-center rounded-lg border border-line bg-paper/90 shadow-sm backdrop-blur hover:bg-surface disabled:opacity-40"
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2">
                      <path d={button.icon} />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            <figcaption className="mt-2 font-mono text-[11px] text-muted">
              {caption} Aproxima com os botões, com dois dedos ou com Ctrl e a roda; arrasta para mover.
            </figcaption>
          </figure>

          <div ref={cardRef} className="order-2 scroll-mt-20 lg:order-none lg:col-span-2 xl:col-span-1">
            <div className="xl:sticky xl:top-20">
              {current ? (
                <PlaceCard key={current.key} place={current} level={level} onClose={() => choose(null)} />
              ) : party ? (
                <PartyPlaces
                  item={legend.find((entry) => entry.key === party) ?? null}
                  places={places.filter((place) => place.group === party)}
                  unit={unit}
                  onPick={(key) => choose(key, { zoomIn: true })}
                  onClose={() => light(null)}
                />
              ) : (
                <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-muted">
                  <p className="font-bold text-ink">Carrega num {unit[0]}</p>
                  <p className="mt-1 text-sm">
                    para ver quem preside à câmara, como se dividem os vereadores e o que há para ver a seguir.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** The lit party's câmaras, so a party with three is as easy to find as one with a hundred. */
function PartyPlaces({
  item,
  places,
  unit,
  onPick,
  onClose,
}: {
  item: LegendItem | null;
  places: MayorMapPlace[];
  unit: string[];
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  if (!item) return null;
  const sorted = [...places].sort((a, b) => a.name.localeCompare(b.name, "pt"));
  return (
    <section
      aria-labelledby="partido-aceso"
      className="rounded-2xl border border-t-4 border-line p-5"
      style={{ borderTopColor: item.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Destacado no mapa</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Deixar de destacar"
          className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <h3 id="partido-aceso" className="mt-1 flex items-center gap-2 text-2xl font-bold leading-tight">
        <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: item.color }} />
        {item.label}
      </h3>
      <p className="mt-1 font-mono text-xs text-muted">
        {sorted.length} {sorted.length === 1 ? unit[0] : unit[1]}
      </p>
      <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto">
        {sorted.map((place) => (
          <li key={place.key}>
            <button
              type="button"
              onClick={() => onPick(place.key)}
              className="-mx-2 w-[calc(100%+1rem)] rounded px-2 py-2 text-left hover:bg-surface"
            >
              <span className="block font-bold leading-snug">{place.name}</span>
              <span className="block truncate font-mono text-xs text-muted">
                {[place.district, place.mayor ?? place.listLabel].filter(Boolean).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Type a municipality, a district or a mayor; the matches drop down, and arrows and Enter pick one. */
function PlaceSearch({ items, popular, onFind }: { items: SearchItem[]; popular: SearchItem[]; onFind: (item: SearchItem) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return items
      .filter((item) => {
        const text = fold(`${item.name} ${item.district ?? ""} ${item.mayor ?? ""}`);
        return words.every((word) => text.includes(word));
      })
      .sort((a, b) => Number(!fold(a.name).startsWith(words[0]!)) - Number(!fold(b.name).startsWith(words[0]!)))
      .slice(0, 8);
  }, [items, query]);
  const showList = open && query.trim().length > 0;
  const current = Math.min(active, Math.max(matches.length - 1, 0));

  function pick(item: SearchItem) {
    onFind(item);
    setQuery("");
    setOpen(false);
  }

  // The browser asks first; the point goes to the API once, which says which concelho it is in and keeps nothing.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  function locate() {
    if (!("geolocation" in navigator)) return setLocateError("Este browser não consegue dar a tua localização.");
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const place = await locatePlace(coords.latitude, coords.longitude);
          const item = items.find((candidate) => candidate.key === place.key);
          if (item) onFind(item);
          else setLocateError(`Estás em ${place.name}, mas não o encontrámos no mapa.`);
        } catch (failure) {
          setLocateError(
            failure instanceof ApiError && failure.status === 404
              ? "Parece que não estás em Portugal. Procura o concelho pelo nome."
              : "Não foi possível encontrar o teu concelho. Procura-o pelo nome.",
          );
        } finally {
          setLocating(false);
        }
      },
      (failure) => {
        setLocating(false);
        setLocateError(
          failure.code === failure.PERMISSION_DENIED
            ? "Sem autorização para ver a tua localização. Procura o concelho pelo nome."
            : "Não foi possível obter a tua localização. Procura o concelho pelo nome.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 },
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length === 0) return;
      setOpen(true);
      setActive((current + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
    } else if (event.key === "Enter" && showList && matches[current]) {
      event.preventDefault();
      pick(matches[current]!);
    } else if (event.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <div className="mb-10 max-w-3xl rounded-2xl border border-line p-4">
      <div className="relative">
        <label htmlFor={`${id}-input`} className="sr-only">
          Procurar concelho, distrito ou presidente
        </label>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 fill-none stroke-muted stroke-2"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13 13l4 4" />
        </svg>
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList && matches[current] ? `${id}-${matches[current]!.key}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Escreve o teu concelho, distrito ou presidente"
          className="h-12 w-full rounded-xl border border-line bg-paper pl-11 pr-4 placeholder:text-muted focus:border-ink focus:outline-none"
        />
        {showList && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Locais encontrados"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-xl border border-line bg-paper p-1 shadow-lg"
          >
            {matches.length === 0 ? (
              <li role="presentation" className="px-3 py-2 text-sm text-muted">
                Nenhum concelho ou distrito com esse nome.
              </li>
            ) : (
              matches.map((item, index) => (
                <li
                  key={item.key}
                  id={`${id}-${item.key}`}
                  role="option"
                  aria-selected={index === current}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(item)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${index === current ? "bg-surface" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: item.color ?? "var(--line)" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{item.name}</span>
                    <span className="block truncate font-mono text-xs text-muted">
                      {item.kind === "district"
                        ? "Distrito"
                        : [item.district && `Distrito de ${item.district}`, item.mayor].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink px-3 py-1 font-mono text-xs font-bold hover:bg-surface disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 fill-none stroke-current stroke-2">
            <path d="M10 18s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10z" />
            <circle cx="10" cy="8" r="2" />
          </svg>
          {locating ? "A localizar…" : "Usar a minha localização"}
        </button>
        {locateError && (
          <span role="alert" className="font-mono text-xs text-danger">
            {locateError}
          </span>
        )}
      </div>
      {popular.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted">Mais procurados:</span>
          {popular.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onFind(item)}
              className="rounded-full border border-line px-3 py-1 font-mono text-xs hover:bg-surface"
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The chosen place: who runs it, the câmara's seats, and where to go next. */
function PlaceCard({ place, level, onClose }: { place: MayorMapPlace; level: "municipality" | "district"; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["place", place.key],
    queryFn: () => getPlaceDetail(place.key),
    enabled: level === "municipality",
  });
  const chamber = detail.data?.council?.organs.find((organ) => organ.organ === "CM") ?? null;
  const seats = chamber ? [...chamber.seats].sort((a, b) => b.mandates - a.mandates) : [];
  const winner = seats[0] ?? null;

  return (
    <section
      aria-labelledby="local-escolhido"
      className="rounded-2xl border border-t-4 border-line p-5"
      style={{ borderTopColor: place.color ?? "var(--line)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          {level === "district" ? "Distrito" : place.district ? `Distrito de ${place.district}` : "Concelho"}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <h3 id="local-escolhido" className="mt-1 text-2xl font-bold leading-tight">
        {place.name}
      </h3>

      {level === "municipality" ? (
        <>
          {place.mayor && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface p-3">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                style={{ boxShadow: `0 0 0 2px ${place.color ?? "var(--line)"}` }}
              >
                {initials(place.mayor)}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[10px] uppercase tracking-widest text-muted">Presidente da câmara</span>
                <span className="block font-bold leading-snug">{place.mayor}</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: place.color ?? "var(--line)" }} />
                  {place.listLabel ?? "Independente"}
                </span>
              </span>
            </div>
          )}

          {chamber && winner && (
            <div className="mt-4">
              <p className="flex justify-between gap-2 font-mono text-[11px] text-muted">
                <span>Vereadores na câmara</span>
                <span>
                  {winner.mandates} de {chamber.totalMandates} · {winner.mandates * 2 > chamber.totalMandates ? "maioria" : "sem maioria"}
                </span>
              </p>
              <ul aria-label="Vereadores por lista" className="mt-1.5 flex flex-wrap gap-1">
                {seats.flatMap((seat) =>
                  Array.from({ length: seat.mandates }, (_, index) => (
                    <li
                      key={`${seat.list}-${index}`}
                      title={`${seat.label}: ${seat.mandates}`}
                      aria-label={index === 0 ? `${seat.label}: ${seat.mandates}` : undefined}
                      aria-hidden={index === 0 ? undefined : true}
                      className="h-4 w-4 rounded-[3px]"
                      style={{ backgroundColor: seat.parties[0] ? partyColor(seat.parties[0]) : "var(--muted)" }}
                    />
                  )),
                )}
              </ul>
            </div>
          )}
          {detail.isPending && <p className="mt-4 font-mono text-xs text-muted">A carregar a câmara…</p>}
        </>
      ) : (
        place.breakdown && (
          <ul className="mt-3 space-y-1 font-mono text-xs">
            {place.breakdown.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="flex-1 font-bold">{item.label}</span>
                <span>
                  {item.count} {item.count === 1 ? "câmara" : "câmaras"}
                </span>
              </li>
            ))}
          </ul>
        )
      )}

      <ul className="mt-4 space-y-2">
        {(level === "municipality"
          ? [
              { href: `${place.href}#orgaos`, label: "Câmara e assembleia municipal" },
              { href: `${place.href}#eleicoes`, label: "Eleições neste concelho" },
              { href: `/contratos?local=${place.key}`, label: "Contratos públicos" },
            ]
          : [
              { href: place.href, label: "Presidentes de câmara do distrito" },
              { href: `/contratos?local=${place.key}`, label: "Contratos públicos" },
            ]
        ).map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 font-mono text-xs font-bold hover:bg-surface"
            >
              {item.label}
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

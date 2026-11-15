import Link from "next/link";
import type { ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import type { PlaceMap } from "@/lib/maps";

export type MapPlace = {
  code: string;
  name: string;
  href: string;
  color: string | null;
  winner: string | null;
  pct: number | null;
  /** What the place says to screen readers and on hover, instead of "Name: winner, %". */
  label?: string;
};

/** Stronger colour for a bigger win, so landslides and close calls look different. */
const strength = (pct: number | null) => (pct === null ? 0.5 : 0.45 + (Math.min(Math.max(pct - 20, 0), 40) / 40) * 0.55);

/**
 * The places inside this one, coloured by who came first, each a link one level down. Drawn on the server from the
 * official boundaries; the list beside it says the same in words.
 */
export function ElectionMap({
  map,
  places,
  label,
  solid = false,
  caption,
  highlight,
}: {
  map: PlaceMap;
  places: MapPlace[];
  label: string;
  /** Every place in full colour, when the colour is not a share of the vote. */
  solid?: boolean;
  /** Replaces the legend of winners. */
  caption?: ReactNode;
  /** One place drawn outlined, e.g. the page's own place. */
  highlight?: string;
}) {
  const byCode = new Map(places.map((place) => [place.code, place]));
  const winners = new Map<string, { color: string; count: number }>();
  for (const place of places) {
    if (!place.winner || !place.color) continue;
    const current = winners.get(place.winner) ?? { color: place.color, count: 0 };
    winners.set(place.winner, { ...current, count: current.count + 1 });
  }

  return (
    <figure className="mb-5">
      <svg viewBox={map.viewBox} role="group" aria-label={label} className="block h-auto max-h-[28rem] w-full">
        {map.insets.map(([x0, y0, x1, y1]) => (
          <rect
            key={`${x0}-${y0}`}
            x={x0! - 8}
            y={y0! - 8}
            width={x1! - x0! + 16}
            height={y1! - y0! + 16}
            rx={6}
            className="fill-none stroke-muted"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {map.shapes.map((shape) => {
          const place = byCode.get(shape.code);
          if (!place) return null;
          const text = place.label ?? (place.winner ? `${place.name}: ${place.winner}, ${formatPercent(place.pct)}` : place.name);
          return (
            <Link key={shape.code} href={place.href} aria-label={text} className="group outline-none">
              <title>{text}</title>
              <path
                d={shape.d}
                fill={place.color ?? "var(--line)"}
                fillOpacity={solid ? 0.9 : strength(place.pct)}
                className={`${shape.code === highlight ? "stroke-ink [stroke-width:2.5]" : "stroke-paper"} transition-[fill-opacity] group-hover:[fill-opacity:1] group-focus-visible:stroke-ink group-focus-visible:[stroke-width:3]`}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </Link>
          );
        })}
      </svg>
      {caption ??
        (winners.size > 0 && (
          <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
            {[...winners].map(([name, { color, count }]) => (
              <span key={name} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="font-bold text-ink">{name}</span> {count}
              </span>
            ))}
            <span>· cor mais forte, vitória mais larga</span>
          </figcaption>
        ))}
    </figure>
  );
}

export const winnerColor = (slugs: string[]) => (slugs[0] ? partyColor(slugs[0]) : null);

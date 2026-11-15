/**
 * Geometry for the official seat map. Seats come with floor positions from the API: x from 0 (left) to the
 * map width, y from 0 (back row) to the map height (front, by the Mesa). Pure functions, tested without a browser.
 */

type Point = { x: number; y: number };

/** Where the seats look: the middle of the front, by the Mesa. */
export const focusOf = (map: { width: number; height: number }): Point => ({ x: map.width / 2, y: map.height });

/** Distance from the Mesa (a proxy for the row) and angle, from π on the far left to 0 on the far right. */
export function polar(seat: Point, focus: Point): { radius: number; angle: number } {
  const dx = seat.x - focus.x;
  const dy = focus.y - seat.y;
  return { radius: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
}

/** Degrees to turn a seat drawn facing down so it faces the Mesa. */
export function facing(seat: Point, focus: Point): number {
  const { angle } = polar(seat, focus);
  return 90 - (angle * 180) / Math.PI;
}

/** The smallest gap between two seats, used to size them. */
export function seatSpacing(seats: readonly Point[]): number {
  let closest = Infinity;
  for (let a = 0; a < seats.length; a++) {
    for (let b = a + 1; b < seats.length; b++) {
      closest = Math.min(closest, Math.hypot(seats[a]!.x - seats[b]!.x, seats[a]!.y - seats[b]!.y));
    }
  }
  return Number.isFinite(closest) ? closest : 0.05;
}

export type Direction = "left" | "right" | "back" | "front";

/**
 * The seat to move to with an arrow key: along the same row for left and right, to the next row for back
 * (further from the Mesa) and front. Rows are judged by distance from the Mesa, within half a seat.
 */
export function neighbourSeat<T extends Point>(
  seats: readonly T[],
  from: T,
  direction: Direction,
  focus: Point,
  spacing: number,
): T | undefined {
  const origin = polar(from, focus);
  let best: T | undefined;
  let bestScore = Infinity;

  for (const seat of seats) {
    if (seat === from) continue;
    const { radius, angle } = polar(seat, focus);
    const dRadius = radius - origin.radius;
    const dArc = (angle - origin.angle) * origin.radius;
    let score: number;
    if (direction === "left" || direction === "right") {
      if (Math.abs(dRadius) > spacing / 2) continue;
      if (direction === "left" ? dArc <= 0 : dArc >= 0) continue;
      score = Math.abs(dArc);
    } else {
      if (direction === "back" ? dRadius <= spacing / 2 : dRadius >= -spacing / 2) continue;
      score = Math.abs(dRadius) + Math.abs(dArc) * 2;
    }
    if (score < bestScore) {
      bestScore = score;
      best = seat;
    }
  }
  return best;
}

/** Radius of the back row in the arranged chamber; the drawing is sized from it. */
export const OUTER_RADIUS = 400;

/**
 * A regular hemicycle: concentric rows with evenly spaced seats, each party a contiguous sector. The official
 * floor plan has aisles and uneven rows that read as scattered dots at this size. Parties go left to right in
 * `order`; any party not in it takes its place from the official plan. Each official seat keeps its number. Returns positions in
 * a box `width` × `height` whose bottom centre is the Mesa.
 */
export function arrangeSeats<T extends Point & { partySlug: string }>(
  seats: readonly T[],
  focus: Point,
  order: readonly string[] = [],
): { seats: T[]; width: number; height: number } {
  const total = seats.length;
  const rows = Math.max(3, Math.round(Math.sqrt(total / 2.8)));
  // The inner row's share of the outer radius that makes the gap between rows match the gap along a row.
  const arcFactor = (Math.PI * rows) / (2 * total);
  const gapFactor = 1 / (rows - 1);
  const innerShare = (gapFactor - arcFactor) / (gapFactor + arcFactor);
  const radii = Array.from({ length: rows }, (_, row) => OUTER_RADIUS * (innerShare + ((1 - innerShare) * row) / (rows - 1)));
  const radiusSum = radii.reduce((sum, radius) => sum + radius, 0);

  // Seats per row in proportion to its length; the remainder goes to the back rows.
  const counts = radii.map((radius) => Math.floor((total * radius) / radiusSum));
  for (let row = rows - 1, left = total - counts.reduce((a, b) => a + b, 0); left > 0; row = row === 0 ? rows - 1 : row - 1, left--)
    counts[row]!++;

  const spacing = (Math.PI * radiusSum) / total;
  const margin = OUTER_RADIUS + spacing;
  const places: { x: number; y: number; along: number; radius: number }[] = [];
  radii.forEach((radius, row) => {
    const count = counts[row]!;
    // Half a seat in from each end, so the ends of every row line up with the floor's edge.
    const edge = spacing / 2 / radius;
    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI - edge - ((Math.PI - 2 * edge) * i) / (count - 1);
      places.push({
        x: margin + radius * Math.cos(angle),
        y: margin - radius * Math.sin(angle),
        along: count === 1 ? 0.5 : i / (count - 1),
        radius,
      });
    }
  });
  // Filled left to right by how far along its row each seat is, front row first. Seats at the same point of
  // every row form a spoke, so a small party is a short line from the front back, not a sliver along the floor.
  places.sort((a, b) => a.along - b.along || a.radius - b.radius);

  // Parties in their official order, left to right, and each party's seats in official order within it.
  const official = seats.map((seat) => ({ seat, ...polar(seat, focus) }));
  const partyAngle = new Map<string, number[]>();
  for (const { seat, angle } of official) partyAngle.set(seat.partySlug, [...(partyAngle.get(seat.partySlug) ?? []), angle]);
  const mean = (slug: string) => {
    const angles = partyAngle.get(slug)!;
    return angles.reduce((a, b) => a + b, 0) / angles.length;
  };
  // Listed parties come first, in order; the rest follow by their mean angle in the official plan.
  const rank = (slug: string) => (order.includes(slug) ? 2 * Math.PI + order.length - order.indexOf(slug) : mean(slug));
  official.sort((a, b) => rank(b.seat.partySlug) - rank(a.seat.partySlug) || b.angle - a.angle || a.radius - b.radius);

  return {
    seats: official.map(({ seat }, index) => ({ ...seat, x: places[index]!.x, y: places[index]!.y })),
    width: margin * 2,
    height: margin,
  };
}

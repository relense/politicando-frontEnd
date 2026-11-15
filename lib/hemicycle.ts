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
 * `order`; any party not in it takes its place from the official plan. Each official seat keeps its number and
 * its rank within the party: front-row seats near the middle of the party's block stay at the front, near the
 * middle of its sector, so whoever sits there (the party's leaders, in the backend's estimate) stays there too.
 * Returns positions in a box `width` × `height` whose bottom centre is the Mesa.
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
  const places: { x: number; y: number; along: number; radius: number; row: number; angle: number }[] = [];
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
        row,
        angle,
      });
    }
  });
  // Filled left to right by how far along its row each seat is, front row first. Seats at the same point of
  // every row form a spoke, so a small party is a short line from the front back, not a sliver along the floor.
  places.sort((a, b) => a.along - b.along || a.radius - b.radius);

  // Parties in their official order, left to right.
  const officialRow = rowsOf(seats, focus);
  const official = seats.map((seat, index) => ({ seat, row: officialRow[index]!, ...polar(seat, focus) }));
  const partyAngle = new Map<string, number[]>();
  for (const { seat, angle } of official) partyAngle.set(seat.partySlug, [...(partyAngle.get(seat.partySlug) ?? []), angle]);
  const mean = (angles: number[]) => angles.reduce((a, b) => a + b, 0) / angles.length;
  // Listed parties come first, in order; the rest follow by their mean angle in the official plan.
  const rank = (slug: string) => (order.includes(slug) ? 2 * Math.PI + order.length - order.indexOf(slug) : mean(partyAngle.get(slug)!));
  const parties = [...partyAngle.keys()].sort((a, b) => rank(b) - rank(a));

  // Each party takes the next stretch of places. Within it, seats are matched by rank: front row first, then
  // nearest the middle of the block, in the official plan and in the drawing alike.
  const byRank = <P extends { row: number; angle: number }>(items: P[]) => {
    const centre = mean(items.map((item) => item.angle));
    return [...items].sort((a, b) => a.row - b.row || Math.abs(a.angle - centre) - Math.abs(b.angle - centre));
  };
  const arranged: T[] = [];
  let start = 0;
  for (const slug of parties) {
    const own = official.filter((item) => item.seat.partySlug === slug);
    const stretch = byRank(places.slice(start, start + own.length));
    byRank(own).forEach((item, index) => arranged.push({ ...item.seat, x: stretch[index]!.x, y: stretch[index]!.y }));
    start += own.length;
  }

  return { seats: arranged, width: margin * 2, height: margin };
}

/** The row of each official seat, counted from the front: seats are in the same row when their distances to the Mesa are close. */
function rowsOf(seats: readonly Point[], focus: Point): number[] {
  const gap = seatSpacing(seats) * 0.5;
  const order = seats.map((seat, index) => ({ index, radius: polar(seat, focus).radius })).sort((a, b) => a.radius - b.radius);
  const rows = new Array<number>(seats.length);
  let row = 0;
  order.forEach((item, i) => {
    if (i > 0 && item.radius - order[i - 1]!.radius > gap) row++;
    rows[item.index] = row;
  });
  return rows;
}

/**
 * The Government's bench: arcs in the open floor between the Mesa and the deputies' front row, facing them.
 * Index 0 (the Prime Minister) takes the middle of the front arc; the rest alternate right and left of it in the
 * order given (protocol order), then fill the arc behind. `front` is the radius of the front arc and `step` the
 * distance between seats and between arcs. A seat never sits on the Mesa: within `mesaHalfWidth` of the centre
 * it must be more than `clear` above it. Positions are relative to the hemicycle's focus, y pointing down.
 */
export function governmentBench(
  count: number,
  { front, step, clear, mesaHalfWidth }: { front: number; step: number; clear: number; mesaHalfWidth: number },
): Point[] {
  const fits = (radius: number, angle: number) =>
    angle > 0.2 &&
    angle < Math.PI - 0.2 &&
    (Math.abs(radius * Math.cos(angle)) > mesaHalfWidth + step / 2 || radius * Math.sin(angle) > clear);

  // Seats of an arc from the middle out, alternating right and left: offsets 0, -1, +1, -2, +2… in seats.
  const arc = (radius: number, gap: number, limit: number): Point[] => {
    const seats: Point[] = [];
    for (let i = 0; seats.length < limit; i++) {
      const offset = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 === 1 ? -1 : 1);
      const angle = Math.PI / 2 + (offset * gap) / radius;
      if (!fits(radius, angle)) break;
      seats.push({ x: radius * Math.cos(angle), y: -radius * Math.sin(angle) });
    }
    return seats;
  };
  const layout = (gap: number) => {
    const seats: Point[] = [];
    for (let radius = front; radius > clear && seats.length < count; radius -= gap * 1.05) {
      seats.push(...arc(radius, gap, count - seats.length));
    }
    return seats;
  };

  // Squeeze the seats together when there are more members than room.
  let gap = step;
  let seats = layout(gap);
  while (seats.length < count && gap > step * 0.6) seats = layout((gap *= 0.95));
  return seats;
}

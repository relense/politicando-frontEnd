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
 * A regular hemicycle drawn from the official seating plan. The plan has six rows shaped like a horseshoe, up
 * to 56 seats long, which at this size leaves seats too small to recognise anyone. So the drawing uses concentric
 * rows with evenly spaced seats, about as many rows as fit seats this big, and each official seat goes to the
 * drawn place that sits where it does in the plan: the same depth from the front and the same point from left to
 * right, chosen for all seats at once so none is pushed far out of place. Along each drawn row the seats then keep
 * the plan's left-to-right order, so their numbers rise steadily. `order` only breaks ties between parties.
 * Returns positions in a box `width` × `height` whose bottom centre is the Mesa.
 */
export function arrangeSeats<T extends Point & { partySlug: string }>(
  seats: readonly T[],
  focus: Point,
  order: readonly string[] = [],
): { seats: T[]; width: number; height: number; rowGap: number } {
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
  const places: { x: number; y: number; along: number; row: number }[] = [];
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
        row,
      });
    }
  });

  // Where each official seat is in the plan, as a depth (0 front, 1 back) and a point from left (0) to right (1).
  const plan = officialRows(seats, focus);
  const planRows = Math.max(...plan.map((item) => item.row));
  const depth = (row: number, of: number) => (of > 0 ? row / of : 0);
  const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length);
  // Depth weighs more: a seat at the front of the plan should stay at the front.
  const cost = seats.map((seat, a) =>
    places.map((place) => {
      const official = plan[a]!;
      return 3 * (depth(official.row, planRows) - depth(place.row, rows - 1)) ** 2 + (official.along - place.along) ** 2;
    }),
  );
  const chosen = assign(cost);

  // Along each drawn row, the seats it got go left to right in the plan's order.
  const arranged: T[] = [];
  for (let row = 0; row < rows; row++) {
    const indexes = places.map((place, index) => ({ place, index })).filter((item) => item.place.row === row);
    const own = indexes
      .map((item) => chosen.indexOf(item.index))
      .sort((a, b) => plan[a]!.along - plan[b]!.along || rank(seats[a]!.partySlug) - rank(seats[b]!.partySlug) || a - b);
    indexes.sort((a, b) => a.place.along - b.place.along);
    indexes.forEach((item, k) => arranged.push({ ...seats[own[k]!]!, x: item.place.x, y: item.place.y }));
  }

  return { seats: arranged, width: margin * 2, height: margin, rowGap: (OUTER_RADIUS * (1 - innerShare)) / (rows - 1) };
}

/**
 * The cheapest one-to-one assignment of rows to columns in a square cost matrix (the Hungarian method). Returns,
 * for each row, its column.
 */
function assign(cost: number[][]): number[] {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const match = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let row = 1; row <= n; row++) {
    match[0] = row;
    let column = 0;
    const least = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[column] = true;
      const current = match[column]!;
      let delta = Infinity;
      let next = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const reduced = cost[current - 1]![j - 1]! - u[current]! - v[j]!;
        if (reduced < least[j]!) {
          least[j] = reduced;
          way[j] = column;
        }
        if (least[j]! < delta) {
          delta = least[j]!;
          next = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[match[j]!]! += delta;
          v[j]! -= delta;
        } else least[j]! -= delta;
      }
      column = next;
    } while (match[column] !== 0);
    do {
      const previous = way[column]!;
      match[column] = match[previous]!;
      column = previous;
    } while (column !== 0);
  }
  const result = new Array<number>(n);
  for (let j = 1; j <= n; j++) result[match[j]! - 1] = j - 1;
  return result;
}

/**
 * Each official seat's row, counted from the front, and how far along that row it is, from 0 at the left end to 1
 * at the right. The official rows are a horseshoe: straight up at both ends and round over the top, so the seats
 * of a row are the same distance from a short upright line above the Mesa. Its height is fitted to the plan.
 */
function officialRows(seats: readonly Point[], focus: Point): { row: number; along: number }[] {
  const spacing = seatSpacing(seats);
  const relative = seats.map((seat) => ({ x: seat.x - focus.x, y: focus.y - seat.y }));
  const top = Math.max(...relative.map((point) => point.y));
  const distance = (point: { x: number; y: number }, height: number) =>
    point.y < height ? Math.abs(point.x) : Math.hypot(point.x, point.y - height);

  // Rows split where the distance jumps; the right height leaves every row tight.
  const rowsAt = (height: number) => {
    const order = relative.map((point, index) => ({ index, d: distance(point, height) })).sort((a, b) => a.d - b.d);
    const rows = new Array<number>(seats.length);
    let row = 0;
    let first = order[0]?.d ?? 0;
    let spread = 0;
    order.forEach((item, i) => {
      if (i > 0 && item.d - order[i - 1]!.d > spacing * 0.4) {
        row++;
        first = item.d;
      }
      spread = Math.max(spread, item.d - first);
      rows[item.index] = row;
    });
    return { rows, spread };
  };
  let height = 0;
  let best = rowsAt(0);
  for (let step = 1; step <= 40; step++) {
    const candidate = rowsAt((top * step) / 40);
    if (candidate.spread < best.spread - 1e-9) [height, best] = [(top * step) / 40, candidate];
  }

  return relative.map((point, index) => {
    const d = distance(point, height);
    const length = 2 * height + Math.PI * d;
    // Up the left side, over the top, and down the right side.
    const travelled =
      point.y < height && point.x < 0
        ? point.y
        : point.y < height
          ? height + Math.PI * d + (height - point.y)
          : height + d * (Math.PI - Math.atan2(point.y - height, point.x));
    // Rounded so the server and the browser, which can differ in the last digit of trigonometry, place every seat alike.
    return { row: best.rows[index]!, along: length > 0 ? Math.round((travelled / length) * 1e6) / 1e6 : 0.5 };
  });
}

/**
 * Seats for a chamber of any size, drawn as concentric rows and ordered left to right (by angle, then front to
 * back), so consecutive seats given to one list form a wedge, as in the usual parliament chart. Used for election
 * results, where there are seat counts but no seating plan. Box `width` × `height`, the Mesa at the bottom centre.
 */
export function chamberSeats(total: number): { seats: Point[]; width: number; height: number; seatRadius: number } {
  if (total <= 0) return { seats: [], width: 0, height: 0, seatRadius: 0 };
  const rows = Math.max(1, Math.round(Math.sqrt(total / 2.8)));
  const innerShare =
    rows === 1
      ? 1
      : (() => {
          const arcFactor = (Math.PI * rows) / (2 * total);
          const gapFactor = 1 / (rows - 1);
          return Math.max(0.2, (gapFactor - arcFactor) / (gapFactor + arcFactor));
        })();
  const radii = Array.from(
    { length: rows },
    (_, row) => OUTER_RADIUS * (rows === 1 ? 1 : innerShare + ((1 - innerShare) * row) / (rows - 1)),
  );
  const radiusSum = radii.reduce((sum, radius) => sum + radius, 0);
  const counts = radii.map((radius) => Math.floor((total * radius) / radiusSum));
  for (let row = rows - 1, left = total - counts.reduce((a, b) => a + b, 0); left > 0; row = row === 0 ? rows - 1 : row - 1, left--)
    counts[row]!++;
  const spacing = Math.min((Math.PI * radiusSum) / total, rows > 1 ? (OUTER_RADIUS * (1 - innerShare)) / (rows - 1) : Infinity);
  const margin = OUTER_RADIUS + spacing;
  const places: (Point & { angle: number; radius: number })[] = [];
  radii.forEach((radius, row) => {
    const count = counts[row]!;
    const edge = Math.min(spacing / 2 / radius, Math.PI / 4);
    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI - edge - ((Math.PI - 2 * edge) * i) / (count - 1);
      places.push({ x: margin + radius * Math.cos(angle), y: margin - radius * Math.sin(angle), angle, radius });
    }
  });
  places.sort((a, b) => b.angle - a.angle || a.radius - b.radius);
  return { seats: places.map(({ x, y }) => ({ x, y })), width: margin * 2, height: margin, seatRadius: spacing * 0.42 };
}

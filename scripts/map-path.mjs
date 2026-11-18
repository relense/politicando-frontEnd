/**
 * Map outlines as short SVG paths: points rounded to a tenth, then written relative to the one before ("l-1.2.4"),
 * which takes a third less space than absolute points and compresses better. Shared by build-map.mjs and
 * compact-maps.mjs.
 */

const round = (value) => Math.round(value * 10) / 10;

/** "1.5" → "1.5", "0.5" → ".5", "-0.5" → "-.5"; no trailing zeros. */
const num = (value) => {
  const text = String(round(value) || 0);
  return text.replace(/^(-?)0\./, "$1.");
};

/**
 * Numbers one after another. A space only where needed: not before "-", and not before ".5" when the number before
 * already has a decimal point (".2.5" reads as .2 then .5).
 */
function join(values) {
  let out = "";
  let previous = null;
  for (const value of values) {
    const text = num(value);
    const glued = previous === null || text.startsWith("-") || (text.startsWith(".") && previous.includes("."));
    out += (glued ? "" : " ") + text;
    previous = text;
  }
  return out;
}

/** Closed rings ([[x, y], …], in drawing units) as one compact path. */
export function ringsPath(rings) {
  let out = "";
  // After "z" the pen is back at the start of the ring just closed.
  let [px, py] = [0, 0];
  for (const ring of rings) {
    const points = ring.map(([x, y]) => [round(x), round(y)]);
    const [sx, sy] = points[0];
    out += (out === "" ? "M" : "m") + join(out === "" ? [sx, sy] : [sx - px, sy - py]);
    let [cx, cy] = [sx, sy];
    const steps = [];
    for (const [x, y] of points.slice(1)) {
      const [dx, dy] = [round(x - cx), round(y - cy)];
      if (dx === 0 && dy === 0) continue;
      steps.push(dx, dy);
      [cx, cy] = [x, y];
    }
    // The last point back to the first is drawn by "z".
    if (steps.length >= 2 && round(cx - sx) === 0 && round(cy - sy) === 0) steps.splice(-2);
    if (steps.length > 0) out += "l" + join(steps);
    out += "z";
    [px, py] = [sx, sy];
  }
  return out;
}

/** The absolute rings in a path from either format (M/L absolute, or this compact one), for re-encoding and tests. */
export function parseRings(path) {
  const rings = [];
  let ring = null;
  let [cx, cy] = [0, 0];
  let [sx, sy] = [0, 0];
  for (const [, command, body] of path.matchAll(/([MLmlZz])([^MLmlZz]*)/g)) {
    if (command === "Z" || command === "z") {
      [cx, cy] = [sx, sy];
      continue;
    }
    const values = (body.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    for (let i = 0; i + 1 < values.length; i += 2) {
      const relative = command === "m" || command === "l";
      const [x, y] = relative ? [round(cx + values[i]), round(cy + values[i + 1])] : [values[i], values[i + 1]];
      if ((command === "M" || command === "m") && i === 0) {
        ring = [];
        rings.push(ring);
        [sx, sy] = [x, y];
      }
      ring.push([x, y]);
      [cx, cy] = [x, y];
    }
  }
  return rings;
}

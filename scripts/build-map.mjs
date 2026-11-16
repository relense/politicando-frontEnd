/**
 * Builds the election maps from DGT's official boundaries (CAOP 2024, open data):
 *   lib/maps/municipios.json  one shape per municipality, keyed by its INE/DGT code (dicofre "0101")
 *   lib/maps/distritos.json   one per electoral district: "01"–"18", Madeira "30", Açores "40"
 *
 * Run once, when CAOP changes:
 *   1. Download and unzip into one folder:
 *        https://geo2.dgterritorio.gov.pt/caop/CAOP_Continente_2024-gpkg.zip
 *        https://geo2.dgterritorio.gov.pt/caop/CAOP_RAA_2024-gpkg.zip
 *        https://geo2.dgterritorio.gov.pt/caop/CAOP_RAM_2024-gpkg.zip
 *   2. node --experimental-sqlite scripts/build-map.mjs <that folder>
 *
 * No dependencies. The GeoPackages are projected in metres (mainland PT-TM06, the islands UTM), so shapes are drawn
 * as they are, with the Azores and Madeira moved into insets to the left of the mainland. CAOP's borders are
 * topologically clean (neighbours share the very same vertices), so each stretch of border between two points where
 * the neighbours change is simplified once, the same way for both sides: no gaps or overlaps between municipalities.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Drawing units for the mainland's height. */
const HEIGHT = 1000;
/** Douglas–Peucker tolerance, in drawing units: finer for municipalities, which are shown zoomed in on district pages. */
const TOLERANCE = { municipios: 0.35, distritos: 1 };

const folder = process.argv[2];
if (!folder) throw new Error("Usage: node --experimental-sqlite scripts/build-map.mjs <folder with the CAOP .gpkg files>");

// --- Reading GeoPackages: a GPKG header, then standard WKB (multi)polygons. ---

function readWkb(buffer, offset) {
  const little = buffer[offset] === 1;
  const u32 = (at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at));
  const f64 = (at) => (little ? buffer.readDoubleLE(at) : buffer.readDoubleBE(at));
  const raw = u32(offset + 1);
  const type = raw % 1000;
  const dims = raw >= 3000 ? 4 : raw >= 1000 ? 3 : 2;
  let at = offset + 5;
  const ring = () => {
    const n = u32(at);
    at += 4;
    const points = [];
    for (let i = 0; i < n; i++, at += 8 * dims) points.push([f64(at), f64(at + 8)]);
    return points;
  };
  const polygon = () => {
    const n = u32(at);
    at += 4;
    return Array.from({ length: n }, ring);
  };
  if (type === 3) return { polygons: [polygon()], end: at };
  if (type === 6) {
    const n = u32(at);
    at += 4;
    const polygons = [];
    for (let i = 0; i < n; i++) {
      const part = readWkb(buffer, at);
      polygons.push(...part.polygons);
      at = part.end;
    }
    return { polygons, end: at };
  }
  throw new Error(`Unexpected geometry type ${raw}`);
}

function readGpkgGeometry(blob) {
  const buffer = Buffer.from(blob);
  if (buffer.toString("ascii", 0, 2) !== "GP") throw new Error("Not a GeoPackage geometry");
  const envelope = [0, 32, 48, 48, 64][(buffer[3] >> 1) & 7];
  return readWkb(buffer, 8 + envelope).polygons;
}

function municipalities(file) {
  const db = new DatabaseSync(join(folder, file), { readOnly: true });
  const table = db.prepare("select table_name from gpkg_geometry_columns where table_name like '%municipios'").get().table_name;
  const rows = db.prepare(`select dtmn, municipio, geom from "${table}"`).all();
  db.close();
  return rows.map((row) => ({ code: row.dtmn, name: row.municipio, polygons: readGpkgGeometry(row.geom) }));
}

const files = readdirSync(folder).filter((name) => name.endsWith(".gpkg"));
const find = (pattern) => {
  const file = files.find((name) => pattern.test(name));
  if (!file) throw new Error(`Missing ${pattern} in ${folder}`);
  return file;
};

const mainland = municipalities(find(/^Continente/));
// The Selvagens (part of Funchal) lie 280 km south of Madeira and would stretch its inset: they are left out.
const SELVAGENS_NORTH = 3_400_000; // UTM 28N northing, between the Selvagens (~3.33 M) and Madeira (~3.6 M)
const madeira = municipalities(find(/Madeira/)).map((item) => ({
  ...item,
  polygons: item.polygons.filter((polygon) => polygon[0].some(([, y]) => y > SELVAGENS_NORTH)),
}));
const azoresEast = municipalities(find(/Acores_GCentral/));
const azoresWest = municipalities(find(/Acores_GOcidental/));

// --- Placing the islands. Moves keep each archipelago's own vertices shared, since every point moves the same way. ---

function bounds(items) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const item of items)
    for (const polygon of item.polygons)
      for (const [x, y] of polygon[0]) {
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
  return box;
}
const move = (items, f) => items.map((item) => ({ ...item, polygons: item.polygons.map((p) => p.map((r) => r.map(f))) }));

// Flores and Corvo are in UTM zone 25, the other Azores in zone 26. For a small inset a shift is enough: x moves by
// the 6° between the zones' central meridians, at their latitude.
const [, west0, , west1] = bounds(azoresWest);
const westShift = -6 * 111_320 * Math.cos((((west0 + west1) / 2 / 110_950) * Math.PI) / 180);
const azoresTrue = [...azoresEast, ...move(azoresWest, ([x, y]) => [x + westShift, y])];

// The three groups of the Azores are hundreds of kilometres apart, which leaves the islands tiny in any inset. As is
// usual on maps of Portugal, the groups are drawn closer together; the islands within each group keep their places.
const AZORES_GROUPS = { western: ["48", "49"], central: ["43", "44", "45", "46", "47"], eastern: ["41", "42"] };
const AZORES_SPREAD = 0.35;
const azores = (() => {
  const centre = (items) => {
    const [x0, y0, x1, y1] = bounds(items);
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  };
  const [cx, cy] = centre(azoresTrue);
  return Object.values(AZORES_GROUPS).flatMap((heads) => {
    const group = azoresTrue.filter((item) => heads.includes(item.code.slice(0, 2)));
    const [gx, gy] = centre(group);
    const dx = (gx - cx) * (AZORES_SPREAD - 1);
    const dy = (gy - cy) * (AZORES_SPREAD - 1);
    return move(group, ([x, y]) => [x + dx, y + dy]);
  });
})();

const land = bounds(mainland);
const landWidth = land[2] - land[0];
const gap = (land[3] - land[1]) * 0.04;
// Both archipelagos at one scale, so they compare honestly, and as wide as the mainland.
const insetWidth = landWidth * 1.1;
const azoresBox = bounds(azores);
const insetScale = insetWidth / (azoresBox[2] - azoresBox[0]);
const insetLeft = land[0] - gap - insetWidth;

function placeInset(items, top) {
  const [x0, y0, x1, y1] = bounds(items);
  return {
    items: move(items, ([x, y]) => [insetLeft + (x - x0) * insetScale, top - (y1 - y) * insetScale]),
    frame: [insetLeft, top - (y1 - y0) * insetScale, insetLeft + (x1 - x0) * insetScale, top],
  };
}
const azoresInset = placeInset(azores, land[3]);
const madeiraInset = placeInset(madeira, azoresInset.frame[1] - gap * 2);

// --- Into drawing units: x right, y down, the mainland HEIGHT tall, the insets' left edge at 0. ---

const scale = HEIGHT / (land[3] - land[1]);
const project = ([x, y]) => [(x - insetLeft) * scale, (land[3] - y) * scale];
const all = move([...mainland, ...azoresInset.items, ...madeiraInset.items], project);
const frames = [azoresInset.frame, madeiraInset.frame].map(([x0, y0, x1, y1]) => {
  const [a, b] = project([x0, y1]);
  const [c, d] = project([x1, y0]);
  return [a, b, c, d].map((value) => Math.round(value));
});

// --- Simplification that keeps shared borders shared. ---

const key = ([x, y]) => `${x},${y}`;
const owners = new Map();
for (const item of all)
  for (const polygon of item.polygons)
    for (const ring of polygon)
      for (const point of ring) {
        const k = key(point);
        if (!owners.has(k)) owners.set(k, new Set());
        owners.get(k).add(item.code);
      }
const ownersOf = (point) => [...owners.get(key(point))].sort().join("|");

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const length = Math.hypot(bx - ax, by - ay);
    let farthest = -1;
    let distance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      const d = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (d > distance) {
        distance = d;
        farthest = i;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** The same stretch of border, seen from either side, must simplify the same way: so always walk it in one direction. */
function simplifyRun(run, tolerance) {
  const forward = key(run[0]) <= key(run.at(-1));
  const ordered = forward ? run : [...run].reverse();
  const simplified = douglasPeucker(ordered, tolerance);
  return forward ? simplified : simplified.reverse();
}

function simplifyRing(ring, tolerance) {
  const points = key(ring[0]) === key(ring.at(-1)) ? ring.slice(0, -1) : ring;
  const n = points.length;
  const sets = points.map(ownersOf);
  // Fixed points: wherever the neighbours change. A ring with one neighbour all round (an island, or an enclave)
  // gets two fixed points far apart, so it keeps its shape.
  let fixed = points.map((_, i) => sets[i] !== sets[(i + n - 1) % n] || sets[i] !== sets[(i + 1) % n]);
  if (!fixed.some(Boolean)) {
    const start = points.reduce((best, point, i) => (key(point) < key(points[best]) ? i : best), 0);
    const far = points.reduce(
      (best, [x, y], i) =>
        Math.hypot(x - points[start][0], y - points[start][1]) >
        Math.hypot(points[best][0] - points[start][0], points[best][1] - points[start][1])
          ? i
          : best,
      start,
    );
    fixed = points.map((_, i) => i === start || i === far);
  }
  const first = fixed.indexOf(true);
  const out = [];
  let run = [points[first]];
  for (let step = 1; step <= n; step++) {
    const i = (first + step) % n;
    run.push(points[i]);
    if (fixed[i]) {
      out.push(...simplifyRun(run, tolerance).slice(0, -1));
      run = [points[i]];
    }
  }
  return out;
}

const round = (value) => Math.round(value * 10) / 10;
const ringPath = (ring) => `M${ring.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`;
const grow = (box, [x, y]) => {
  box[0] = Math.min(box[0], x);
  box[1] = Math.min(box[1], y);
  box[2] = Math.max(box[2], x);
  box[3] = Math.max(box[3], y);
};
const finish = (box) => box.map((value, i) => (i < 2 ? Math.floor(value) : Math.ceil(value)));

const districtOf = (code) => {
  const head = Number(code.slice(0, 2));
  return head >= 40 ? "40" : head >= 30 ? "30" : code.slice(0, 2);
};

const municipios = {};
// Tiny rings (rocks and islets) vanish at this size; dropping them keeps the files small.
const MIN_AREA = 0.15;
const area = (ring) =>
  Math.abs(ring.reduce((sum, [x, y], i) => sum + x * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * y, 0)) / 2;

for (const item of all) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const rings = [];
  for (const polygon of item.polygons)
    polygon.forEach((ring, index) => {
      const simple = simplifyRing(ring, TOLERANCE.municipios);
      if (simple.length < 3 || (index === 0 && area(simple) < MIN_AREA && item.polygons.length > 1)) return;
      if (index === 0) simple.forEach((point) => grow(box, point));
      rings.push(ringPath(simple));
    });
  municipios[item.code] = { name: item.name, d: rings.join(""), box: finish(box) };
}

// Districts: the edges of their municipalities that face another district or the sea, chained into closed rings.
const boundary = new Map();
const seen = new Set();
for (const item of all)
  for (const polygon of item.polygons)
    for (const ring of polygon) {
      const simple = simplifyRing(ring, TOLERANCE.distritos);
      for (let i = 0; i < simple.length; i++) {
        const a = simple[i];
        const b = simple[(i + 1) % simple.length];
        const edge = [key(a), key(b)].sort().join(";");
        if (seen.has(edge)) continue;
        seen.add(edge);
        const shared = [...owners.get(key(a))].filter((code) => owners.get(key(b)).has(code));
        const districts = new Set(shared.map(districtOf));
        if (shared.length > 1 && districts.size === 1) continue; // inside one district
        for (const district of districts) {
          if (!boundary.has(district)) boundary.set(district, []);
          boundary.get(district).push([a, b]);
        }
      }
    }

function chain(edges) {
  const from = new Map();
  for (const edge of edges) {
    for (const [p, q] of [edge, [edge[1], edge[0]]]) {
      if (!from.has(key(p))) from.set(key(p), []);
      from.get(key(p)).push({ edge, to: q });
    }
  }
  const used = new Set();
  const rings = [];
  for (const edge of edges) {
    if (used.has(edge)) continue;
    used.add(edge);
    const ring = [edge[0], edge[1]];
    for (;;) {
      const next = from.get(key(ring.at(-1))).find((option) => !used.has(option.edge));
      if (!next) break;
      used.add(next.edge);
      if (key(next.to) === key(ring[0])) break;
      ring.push(next.to);
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

const distritos = {};
for (const [code, edges] of boundary) {
  const rings = chain(edges).filter((ring) => area(ring) >= MIN_AREA * 4);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  rings.forEach((ring) => ring.forEach((point) => grow(box, point)));
  distritos[code] = { d: rings.map(ringPath).join(""), box: finish(box) };
}

const width = Math.ceil(Math.max(...Object.values(municipios).map((region) => region.box[2])));
const meta = { source: "CAOP 2024, Direção-Geral do Território", width, height: HEIGHT, insets: frames };
writeFileSync("lib/maps/municipios.json", JSON.stringify({ ...meta, regions: municipios }));
writeFileSync("lib/maps/distritos.json", JSON.stringify({ ...meta, regions: distritos }));
console.log(`Wrote ${Object.keys(municipios).length} municipalities and ${Object.keys(distritos).length} districts (${width}×${HEIGHT}).`);

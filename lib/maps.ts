import distritos from "./maps/distritos.json";
import municipios from "./maps/municipios.json";

/** Built by scripts/build-map.mjs from CAOP 2024; coordinates in drawing units, y down. */
type MapFile = {
  source: string;
  width: number;
  height: number;
  /** Frames around the Azores and Madeira insets, as [x0, y0, x1, y1]. */
  insets: number[][];
  regions: Record<string, { d: string; box: number[]; name?: string }>;
};

const FILES: Record<"district" | "municipality", MapFile> = { district: distritos, municipality: municipios };
/** The same outlines as files in public/mapas (written by scripts/compact-maps.mjs), for the browser to load and keep. */
const PUBLIC: Record<"district" | "municipality", string> = { district: "/mapas/distritos.json", municipality: "/mapas/municipios.json" };

/** Changes whenever the outlines do, so the browser can keep each version for good. */
const version = (file: MapFile) => {
  let hash = 0;
  for (const region of Object.values(file.regions))
    for (let i = 0; i < region.d.length; i += 7) hash = (hash * 31 + region.d.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
};
const VERSIONS = { district: version(distritos), municipality: version(municipios) };

export type MapShape = { code: string; d: string };
export type PlaceMap = {
  viewBox: string;
  /** Empty when the outlines come from `outlines` instead, in the browser. */
  shapes: MapShape[];
  insets: number[][];
  source: string;
  /** With `inline: false`: the file to load the outlines from, and the codes to draw. */
  outlines?: { url: string; codes: string[] };
};

/**
 * Shapes for places of one level, by their dicofre code, framed to fit them. Null when fewer than half have a shape
 * (parishes, abroad), so the page shows only the list.
 */
export function placeMap(level: string, codes: (string | null)[], { inline = true } = {}): PlaceMap | null {
  const file = level === "district" || level === "municipality" ? FILES[level] : null;
  if (!file || codes.length === 0) return null;
  const shapes = codes.flatMap((code) => (code && file.regions[code] ? [{ code, d: file.regions[code].d }] : []));
  if (shapes.length < Math.max(1, codes.length / 2)) return null;

  const boxes = shapes.map((shape) => file.regions[shape.code]!.box);
  const x0 = Math.min(...boxes.map((box) => box[0]!));
  const y0 = Math.min(...boxes.map((box) => box[1]!));
  const x1 = Math.max(...boxes.map((box) => box[2]!));
  const y1 = Math.max(...boxes.map((box) => box[3]!));
  const pad = Math.max(x1 - x0, y1 - y0) * 0.03;
  // Inset frames only when the islands are drawn beside the mainland.
  const insets = file.insets.filter((frame) => frame[0]! >= x0 - pad && frame[2]! <= x1 + pad && x1 - x0 > (frame[2]! - frame[0]!) * 1.2);
  const viewBox = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2].map((value) => Math.round(value)).join(" ");
  if (inline) return { viewBox, shapes, insets, source: file.source };
  // The whole country's outlines are big (~200 KB): sent in the page they would go twice, in the HTML and in the data
  // React hydrates from. As a file, the browser downloads them once and keeps them.
  const key = level as "district" | "municipality";
  return {
    viewBox,
    shapes: [],
    insets,
    source: file.source,
    outlines: { url: `${PUBLIC[key]}?v=${VERSIONS[key]}`, codes: shapes.map((shape) => shape.code) },
  };
}

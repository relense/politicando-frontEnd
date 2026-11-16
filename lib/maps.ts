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

export type MapShape = { code: string; d: string };
export type PlaceMap = { viewBox: string; shapes: MapShape[]; insets: number[][]; source: string };

/**
 * Shapes for places of one level, by their dicofre code, framed to fit them. Null when fewer than half have a shape
 * (parishes, abroad), so the page shows only the list.
 */
export function placeMap(level: string, codes: (string | null)[]): PlaceMap | null {
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
  return {
    viewBox: [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2].map((value) => Math.round(value)).join(" "),
    shapes,
    insets,
    source: file.source,
  };
}

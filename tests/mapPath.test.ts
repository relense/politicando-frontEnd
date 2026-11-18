import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import distritos from "@/lib/maps/distritos.json";
import municipios from "@/lib/maps/municipios.json";
import { parseRings, ringsPath } from "../scripts/map-path.mjs";

type Ring = [number, number][];

describe("compact map paths", () => {
  it("keep every point, negative and fractional ones included", () => {
    const rings: Ring[] = [
      [
        [10, 10],
        [10.5, 9.5],
        [10.5, 9.5],
        [0.2, 0.7],
        [-3.1, 12],
      ],
      [
        [100, 50.5],
        [99.9, 50.4],
        [101.3, 49.9],
      ],
    ];
    const path = ringsPath(rings);
    expect(path).toBe("M10 10l.5-.5-10.3-8.8-3.3 11.3zm90 40.5l-.1-.1 1.4-.5z");
    // The repeated point goes; nothing else changes.
    expect(parseRings(path)).toEqual([[rings[0]![0], rings[0]![1], rings[0]![3], rings[0]![4]], rings[1]]);
  });

  it("re-encode the committed maps unchanged, and the public files match them", () => {
    for (const [file, name] of [
      [municipios, "municipios"],
      [distritos, "distritos"],
    ] as const) {
      const outlines = JSON.parse(readFileSync(`public/mapas/${name}.json`, "utf8")) as Record<string, string>;
      for (const [code, region] of Object.entries(file.regions)) {
        expect(ringsPath(parseRings(region.d))).toBe(region.d);
        expect(outlines[code]).toBe(region.d);
      }
    }
  });
});

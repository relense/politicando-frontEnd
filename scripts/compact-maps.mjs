/**
 * Re-encodes lib/maps/*.json with the compact paths of map-path.mjs (without fetching CAOP again), and writes the
 * outlines alone to public/mapas/, for the pages that load them in the browser. build-map.mjs runs this at its end.
 *
 *   node scripts/compact-maps.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseRings, ringsPath } from "./map-path.mjs";

for (const name of ["municipios", "distritos"]) {
  const file = `lib/maps/${name}.json`;
  const map = JSON.parse(readFileSync(file, "utf8"));
  for (const region of Object.values(map.regions)) region.d = ringsPath(parseRings(region.d));
  writeFileSync(file, JSON.stringify(map));
  const outlines = Object.fromEntries(Object.entries(map.regions).map(([code, region]) => [code, region.d]));
  writeFileSync(`public/mapas/${name}.json`, JSON.stringify(outlines));
  console.log(`${file}: ${Object.keys(map.regions).length} regions`);
}

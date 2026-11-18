import { describe, expect, it } from "vitest";
import distritos from "@/lib/maps/distritos.json";
import municipios from "@/lib/maps/municipios.json";
import { placeMap } from "@/lib/maps";

const ELECTORAL_DISTRICTS = [...Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, "0")), "30", "40"];

describe("election maps", () => {
  it("has every electoral district and all 308 municipalities, each with a shape inside the drawing", () => {
    expect(Object.keys(distritos.regions).sort()).toEqual(ELECTORAL_DISTRICTS.sort());
    expect(Object.keys(municipios.regions)).toHaveLength(308);
    for (const file of [distritos, municipios]) {
      for (const region of Object.values(file.regions)) {
        expect(region.d).toMatch(/^M[\d.]+[ -][\d.]+l/);
        const [x0, y0, x1, y1] = region.box as [number, number, number, number];
        expect(x0).toBeGreaterThanOrEqual(0);
        expect(y0).toBeGreaterThanOrEqual(0);
        expect(x1).toBeLessThanOrEqual(file.width + 1);
        expect(y1).toBeLessThanOrEqual(file.height + 1);
      }
    }
    expect(municipios.regions["0101"]!.name).toBe("Águeda");
  });

  it("frames a district's municipalities, and gives up on places without shapes", () => {
    const aveiro = placeMap("municipality", ["0101", "0105", "0113"])!;
    expect(aveiro.shapes.map((shape) => shape.code)).toEqual(["0101", "0105", "0113"]);
    const [, , width, height] = aveiro.viewBox.split(" ").map(Number);
    expect(width).toBeLessThan(200);
    expect(height).toBeLessThan(200);
    expect(aveiro.insets).toEqual([]);

    const country = placeMap("district", ELECTORAL_DISTRICTS)!;
    expect(country.shapes).toHaveLength(20);
    expect(country.insets).toHaveLength(2);

    expect(placeMap("parish", ["010101"])).toBeNull();
    expect(placeMap("municipality", [null, null, "0101"])).toBeNull();
    expect(placeMap("district", [])).toBeNull();
  });
});

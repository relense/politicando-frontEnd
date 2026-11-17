import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const domineBold = readFile(join(process.cwd(), "assets/fonts/Domine-Bold.ttf")).catch(() => null);

/** The site's mark: a yellow P on ink, square. For the browser tab, phones' home screens and search results. */
export async function iconImage(size: number, rounded = false) {
  const font = await domineBold;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#191919",
        color: "#f0c75e",
        fontSize: size * 0.72,
        fontWeight: 700,
        borderRadius: rounded ? size * 0.22 : 0,
        ...(font ? { fontFamily: "Domine" } : {}),
      }}
    >
      P
    </div>,
    { width: size, height: size, fonts: font ? [{ name: "Domine", data: font, weight: 700, style: "normal" }] : undefined },
  );
}

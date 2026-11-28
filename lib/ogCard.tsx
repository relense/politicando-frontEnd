import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The site's heading face (Domine, SIL Open Font License), for the titles; the rest uses the renderer's own font.
const domineBold = readFile(join(process.cwd(), "assets/fonts/Domine-Bold.ttf")).catch(() => null);

/** Social preview images (WhatsApp, X, Facebook, LinkedIn…): 1200×630, the size they all crop to. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";
/** How long a shared cache (Cloudflare) keeps a social preview. */
export const OG_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=3600";

const INK = "#191919";
const MUTED = "#625d56";
const PAPER = "#ffffff";
const SURFACE = "#f6f4f0";
const MARKER = "#f0c75e";

type Card = {
  /** Small line above the title: the section ("Parlamento · Deputado"). */
  kicker: string;
  title: string;
  /** One line under the title. */
  subtitle?: string | null;
  /** A party's colour for the band on the left; the site's yellow otherwise. */
  color?: string;
  /** A big badge on the right: a party's acronym, a number. */
  badge?: string | null;
  /** A picture on the right (a post's cover). Must be an absolute URL. */
  image?: string | null;
};

const fit = (title: string) => (title.length > 90 ? 46 : title.length > 55 ? 56 : 68);

/** The site's card: the name, the section, the title, and the address. Plain shapes only, so it renders anywhere. */
export async function ogCard({ kicker, title, subtitle, color = MARKER, badge, image }: Card) {
  const heading = await domineBold;
  const titleFont = heading ? { fontFamily: "Domine" } : {};
  const shown = title.length > 140 ? `${title.slice(0, 137).trimEnd()}…` : title;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: PAPER, color: INK }}>
      <div style={{ display: "flex", width: 28, height: "100%", background: color }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "56px 64px" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 12, ...titleFont }}>POLITICANDO</div>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 26, color: MUTED, textTransform: "uppercase", letterSpacing: 3 }}>{kicker}</div>
            <div style={{ display: "flex", marginTop: 18, fontSize: fit(shown), fontWeight: 700, lineHeight: 1.12, ...titleFont }}>
              {shown}
            </div>
            {subtitle && (
              <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: MUTED, lineHeight: 1.3 }}>
                {subtitle.length > 110 ? `${subtitle.slice(0, 107).trimEnd()}…` : subtitle}
              </div>
            )}
          </div>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" width={320} height={320} style={{ borderRadius: 24, objectFit: "cover" }} />
          ) : badge ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 220,
                height: 220,
                padding: "0 28px",
                borderRadius: 32,
                background: color,
                color: PAPER,
                fontSize: badge.length > 4 ? 64 : 92,
                fontWeight: 700,
                ...titleFont,
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: MUTED }}>
          <div style={{ display: "flex", background: SURFACE, padding: "8px 18px", borderRadius: 999 }}>politicando.pt</div>
          <div style={{ display: "flex" }}>Política portuguesa, com as fontes</div>
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: heading ? [{ name: "Domine", data: heading, weight: 700, style: "normal" }] : undefined,
      // Next answers these with max-age=0; drawn from data that rarely changes, Cloudflare may keep them for a day.
      headers: { "Cache-Control": OG_CACHE_CONTROL },
    },
  );
}

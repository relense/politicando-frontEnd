import { getImageProps } from "next/image";
import type { DeputySummary } from "./types";

const PARLIAMENT_PHOTO = /^https:\/\/app\.parlamento\.pt\/webutils\/getimage\.aspx\?/;

/** Photos from the Parliament go through our cached route (app/fotos); any other address is used as given. */
export function photoSource(deputy: Pick<DeputySummary, "id" | "photoUrl">): string | null {
  if (!deputy.photoUrl) return null;
  return PARLIAMENT_PHOTO.test(deputy.photoUrl) ? `/fotos/deputados/${deputy.id}` : deputy.photoUrl;
}

/** A small, optimised photo for a seat on the map, sharp on high-density screens. */
export function seatPhoto(deputy: Pick<DeputySummary, "id" | "photoUrl">): string | null {
  const src = photoSource(deputy);
  if (!src) return null;
  if (!src.startsWith("/")) return src;
  // Asking for 32 px gives a 2x source (64 px), about 2 KB.
  return getImageProps({ src, alt: "", width: 32, height: 32 }).props.src;
}

/** The Government portal's photo store, the only remote source the image optimiser accepts (next.config.ts). */
export const PORTAL_PHOTO = /^https:\/\/edge\.sitecorecloud\.io\/centrodeges65c9-cegere0de-prod6279-8af9\/media\//;

/** A Government member's photo at `width` px (2x on dense screens): the portal's resized and cached, anything else as given. */
export function governmentPhoto(url: string | null, width: number): string | null {
  if (!url) return null;
  return PORTAL_PHOTO.test(url) ? getImageProps({ src: url, alt: "", width, height: width }).props.src : url;
}

import { iconImage } from "@/lib/ogIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iPhone and iPad home screens (they round the corners themselves). */
export default function AppleIcon() {
  return iconImage(180);
}

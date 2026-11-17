import { iconImage } from "@/lib/ogIcon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Big enough for Android's home screen and Google's results; browsers scale it for the tab. */
export default function Icon() {
  return iconImage(512);
}

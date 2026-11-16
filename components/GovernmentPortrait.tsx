"use client";

import Image from "next/image";
import { useState } from "react";
import { PORTAL_PHOTO } from "@/lib/photos";

const SIZES = { xs: "size-7 text-[10px]", sm: "size-10 text-xs", md: "size-14 text-base", lg: "size-28 text-3xl" } as const;
const PIXELS = { xs: 28, sm: 40, md: 56, lg: 112 } as const;

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)![0] : ""}`.toUpperCase();
};

/** A member of the Government: the portal's photo, resized and cached, or their initials. */
export function GovernmentPortrait({ name, photoUrl, size }: { name: string; photoUrl: string | null; size: keyof typeof SIZES }) {
  const [failed, setFailed] = useState(false);
  const classes = `${SIZES[size]} shrink-0 rounded-full`;
  if (photoUrl && !failed) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={PIXELS[size]}
        height={PIXELS[size]}
        // Only the portal's photos go through the optimiser (see next.config.ts); anything else as given.
        unoptimized={!PORTAL_PHOTO.test(photoUrl)}
        onError={() => setFailed(true)}
        className={`${classes} bg-surface object-cover object-top`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${classes} flex items-center justify-center bg-surface font-bold text-muted`}>
      {initials(name)}
    </span>
  );
}

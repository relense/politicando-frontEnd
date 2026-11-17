"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";

/** A card's share pill: the phone's share sheet when there is one, otherwise the link is copied. */
export function CardShare({
  path,
  title,
  className,
  compact = false,
}: {
  path: string;
  title: string;
  className: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closing the share sheet is not an error worth showing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: nothing useful to show.
    }
  }

  return (
    <button type="button" onClick={() => void share()} className={className}>
      <ShareIcon />
      {/* Compact: on a phone the arrow alone; the word stays for screen readers. */}
      <span aria-live="polite" className={compact ? "max-sm:sr-only" : ""}>
        {copied ? "Copiada" : "Partilhar"}
      </span>
    </button>
  );
}

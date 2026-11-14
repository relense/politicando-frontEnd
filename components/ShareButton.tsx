"use client";

import { useState } from "react";

/** The phone's share sheet where there is one, otherwise copies the link. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("#")[0]!;
    if (navigator.share) {
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
      // Clipboard blocked: the address bar still has the link.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        className="rounded border border-line px-4 py-2 font-mono text-sm font-bold hover:bg-surface"
      >
        {copied ? "Ligação copiada" : "Partilhar"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Ligação copiada" : ""}
      </span>
    </>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import { ShareIcon } from "./icons";
import { track } from "@/lib/analytics";

const button = "inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface";

/** A phone or tablet that can open its share sheet; on a computer sharing would only copy the link again. */
const canShare = () => typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
const noSubscription = () => () => {};

/** Copy the link and, on a phone, open its share sheet. */
export function ArticleActions({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const shareable = useSyncExternalStore(noSubscription, canShare, () => false);
  const url = () => window.location.href.split("#")[0]!;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      track("share", { network: "copy-link", where: "page" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  }

  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title, url: url() });
      track("share", { network: "share-sheet", where: "page" });
    } catch {
      // Closing the share sheet is not an error worth showing.
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => void copy()} className={button}>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 fill-none stroke-current stroke-2">
          <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5" />
          <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" />
        </svg>
        {copied ? "Ligação copiada" : "Copiar ligação"}
      </button>
      {shareable && (
        <button type="button" onClick={() => void share()} className={button}>
          <ShareIcon />
          Partilhar
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Ligação copiada" : ""}
      </span>
    </div>
  );
}

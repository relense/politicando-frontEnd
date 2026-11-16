"use client";

import { useEffect } from "react";
import { API_BASE_URL } from "@/lib/api/client";

/**
 * Tells the API a post was read, once per post per visit, for "Mais lidos". Sent from the browser because pages are cached.
 * Nothing about the reader goes with it, and a failure (or an API without the endpoint yet) changes nothing on the page.
 */
export function CountRead({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `read-${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: count it anyway.
    }
    const url = `${API_BASE_URL}/editorial/${encodeURIComponent(slug)}/view`;
    if (!navigator.sendBeacon?.(url)) fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  }, [slug]);
  return null;
}

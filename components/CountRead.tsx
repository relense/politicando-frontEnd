"use client";

import { useEffect } from "react";
import { API_BASE_URL } from "@/lib/api/client";

/**
 * Tells the API something was read, once per visit, for the read counts and "Mais lidos". `path` is the API's view
 * endpoint (`/articles/12/view`, `/editorial/slug/view`). Sent from the browser, never the server render, because pages
 * are cached and prefetched. Nothing about the reader goes with it, and a failure (or an API without the endpoint yet)
 * changes nothing on the page.
 */
export function CountRead({ path }: { path: string }) {
  useEffect(() => {
    const key = `read-${path}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: count it anyway.
    }
    const url = `${API_BASE_URL}${path}`;
    if (!navigator.sendBeacon?.(url)) fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}

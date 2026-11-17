"use client";

import { useSyncExternalStore } from "react";
import { FEED_VIEW_COOKIE, parseFeedView, type FeedView } from "./feedViewCookie";

export type { FeedView };

const EVENT = "feed-view";

const read = (): FeedView => {
  try {
    return parseFeedView(document.cookie.match(/(?:^|;\s*)feed-view=([^;]+)/)?.[1]);
  } catch {
    return "cartoes";
  }
};
const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
};

export function setFeedView(view: FeedView) {
  try {
    document.cookie = `${FEED_VIEW_COOKIE}=${view}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // Cookies blocked: the choice lasts until the page is left.
  }
  current = view;
  window.dispatchEvent(new Event(EVENT));
}

// What was chosen this visit, in case the cookie couldn't be written.
let current: FeedView | null = null;

/** The view, starting from what the server read in the cookie. */
export const useFeedView = (initial: FeedView): FeedView =>
  useSyncExternalStore(
    subscribe,
    () => current ?? read(),
    () => initial,
  );

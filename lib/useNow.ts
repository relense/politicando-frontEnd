"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
// Rounded to the minute, so the server and the browser agree on the first render.
const currentMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE);
  return () => clearInterval(id);
}

/** The current time, refreshed every minute, for relative dates. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, currentMinute, currentMinute);
}

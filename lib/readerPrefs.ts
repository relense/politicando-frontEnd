"use client";

import { useSyncExternalStore } from "react";

/**
 * The reader's own choices about the news, kept in this browser (and, with an account, in it too: lib/account.ts): saved and hidden
 * articles, and outlets and parties to see less of. Storage may be blocked: then the choices last until the page is
 * closed. Nothing here is ever sent with the cached feed; lists filtered by it are filtered in the browser.
 */
export type ReaderPrefs = { saved: number[]; hidden: number[]; mutedSources: string[]; mutedParties: string[] };

const KEY = "reader-prefs";
const EVENT = "reader-prefs";
const EMPTY: ReaderPrefs = { saved: [], hidden: [], mutedSources: [], mutedParties: [] };
const LIMIT = 500;

let memory: string | null = null;
let cached: { raw: string; value: ReaderPrefs } | null = null;

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? memory ?? "";
  } catch {
    return memory ?? "";
  }
}

function parse(raw: string): ReaderPrefs {
  if (cached?.raw === raw) return cached.value;
  let value = EMPTY;
  try {
    const data = raw ? (JSON.parse(raw) as Partial<ReaderPrefs>) : {};
    const numbers = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is number => Number.isInteger(item)) : []);
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
    value = {
      saved: numbers(data.saved),
      hidden: numbers(data.hidden),
      mutedSources: strings(data.mutedSources),
      mutedParties: strings(data.mutedParties),
    };
  } catch {
    value = EMPTY;
  }
  cached = { raw, value };
  return value;
}

const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

export function useReaderPrefs(): ReaderPrefs {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return parse(raw);
}

export function readerPrefs(): ReaderPrefs {
  return parse(readRaw());
}

type Listener = (before: ReaderPrefs, after: ReaderPrefs) => void;
const listeners = new Set<Listener>();

/** Told of every change, with the lists before and after (the account sends them on: lib/account.ts). */
export function onReaderPrefsChange(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Puts these lists in place of the browser's (from the reader's account). Listeners are told as for any change. */
export const replaceReaderPrefs = (prefs: ReaderPrefs) => updateReaderPrefs(() => prefs);

export function updateReaderPrefs(change: (prefs: ReaderPrefs) => ReaderPrefs) {
  const before = readerPrefs();
  const next = change(before);
  const trimmed: ReaderPrefs = {
    saved: next.saved.slice(-LIMIT),
    hidden: next.hidden.slice(-LIMIT),
    mutedSources: next.mutedSources.slice(-50),
    mutedParties: next.mutedParties.slice(-50),
  };
  const raw = JSON.stringify(trimmed);
  memory = raw;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Kept for this visit only.
  }
  window.dispatchEvent(new Event(EVENT));
  const after = parse(raw);
  for (const listener of listeners) listener(before, after);
}

export const toggleIn = <T>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

/** Whether the reader asked not to see this article: hidden, or from a muted outlet or about a muted party. */
export function isMuted(prefs: ReaderPrefs, article: { id: number; sourceDomain: string; parties: { slug: string }[] }): boolean {
  // Only articles hidden one by one: "Mostrar menos" was taken out, and any outlet or party muted then is ignored.
  return prefs.hidden.includes(article.id);
}

/**
 * The reader's own poster IDs, per thread, for this browser tab only, so their posts can say "(tu)". Storage can be
 * unavailable (private windows, blocked site data); the page then simply shows no "(tu)".
 */
const key = (threadId: number) => `forum-me-${threadId}`;
const listeners = new Set<() => void>();

/** The stored IDs as a string, which stays equal between reads until something changes (for useSyncExternalStore). */
export function posterIdsSnapshot(threadId: number): string {
  try {
    return sessionStorage.getItem(key(threadId)) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parsePosterIds(snapshot: string): string[] {
  try {
    const stored: unknown = JSON.parse(snapshot);
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Told when this tab remembers a new ID. */
export function subscribePosterIds(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function rememberPosterId(threadId: number, posterId: string): void {
  try {
    const ids = new Set(parsePosterIds(posterIdsSnapshot(threadId))).add(posterId);
    sessionStorage.setItem(key(threadId), JSON.stringify([...ids]));
    for (const listener of listeners) listener();
  } catch {
    // Not remembered: only the "(tu)" label is lost.
  }
}

"use client";

import { useSyncExternalStore } from "react";
import type { AccountState } from "./api/account";
import { setFollow, setSaved, type FollowKind, type SaveKind } from "./api/engagement";
import { track } from "@/lib/analytics";

/*
 * What only an account keeps, with no copy in the browser's own lists: the stories and threads it follows, and the
 * blog posts, comments, threads and replies it saved. Filled from /me/state (lib/account.ts), emptied on logging out,
 * and changed at once on the page while the change travels.
 */

export type Extras = {
  follows: Record<FollowKind, number[]>;
  saved: Record<SaveKind, number[]>;
};

const EMPTY: Extras = { follows: { story: [], thread: [] }, saved: { editorial: [], comment: [], thread: [], reply: [] } };
let extras: Extras = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function setExtrasFrom(state: AccountState) {
  extras = {
    follows: { story: state.follows.stories, thread: state.follows.threads },
    saved: { editorial: state.saved.editorial, comment: state.saved.comments, thread: state.saved.threads, reply: state.saved.replies },
  };
  emit();
}

export function clearExtras() {
  extras = EMPTY;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** For tests and one-off reads. */
export const currentExtras = () => extras;

export const useExtras = () =>
  useSyncExternalStore(
    subscribe,
    () => extras,
    () => EMPTY,
  );

const toggled = (list: number[], id: number, on: boolean) =>
  on ? [id, ...list.filter((item) => item !== id)] : list.filter((item) => item !== id);

/** Shown at once; put back if the API says no. */
async function change(update: (current: Extras) => Extras, send: () => Promise<unknown>) {
  const before = extras;
  extras = update(extras);
  emit();
  try {
    await send();
  } catch (error) {
    extras = before;
    emit();
    throw error;
  }
}

export const follow = (kind: FollowKind, id: number, on: boolean) =>
  change(
    (current) => ({ ...current, follows: { ...current.follows, [kind]: toggled(current.follows[kind], id, on) } }),
    () => setFollow(kind, id, on),
  ).then(() => {
    if (on) track("follow", { kind, id });
  });

/**
 * A merged story's old ids, dropped from this device's list only: the backend moved their follows to the new id, and
 * unfollowing that clears them all (backend docs/stories-api.md).
 */
export function forgetFollowed(kind: FollowKind, ids: readonly number[]) {
  if (!ids.some((id) => extras.follows[kind].includes(id))) return;
  extras = { ...extras, follows: { ...extras.follows, [kind]: extras.follows[kind].filter((id) => !ids.includes(id)) } };
  emit();
}

/** After the reader replied in a thread or commented on a story: the API followed it for them. */
export function markFollowed(kind: FollowKind, id: number) {
  if (extras.follows[kind].includes(id)) return;
  extras = { ...extras, follows: { ...extras.follows, [kind]: [id, ...extras.follows[kind]] } };
  emit();
}

export const save = (kind: SaveKind, id: number, on: boolean) =>
  change(
    (current) => ({ ...current, saved: { ...current.saved, [kind]: toggled(current.saved[kind], id, on) } }),
    () => setSaved(kind, id, on),
  ).then(() => {
    if (on) track("save", { kind, id });
  });

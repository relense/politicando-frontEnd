"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeList,
  getAccountState,
  getReader,
  logOut,
  mergeAccountState,
  type AccountState,
  type ListChange,
  type MergeInput,
  type Reader,
} from "./api/account";
import { LOGIN_REQUIRED_EVENT } from "./api/client";
import { ASK_NEEDS, needsAccount, type AskKind, type Participation } from "./participation";
import type { PendingAction } from "./pendingAction";
import { clearExtras, setExtrasFrom } from "./accountExtras";
import { onReaderPrefsChange, readerPrefs, replaceReaderPrefs, type ReaderPrefs } from "./readerPrefs";

/*
 * The reader's account in the browser. The site keeps drawing from this browser's own lists (saved, hidden, votes,
 * Importa, likes, read), as it did before accounts; with an account those lists are filled from it on every visit,
 * and each change is also sent to it. Logging out empties them, so the next person on the same computer starts clean.
 */

export const READER_KEY = ["reader"];

/** Who is logged in: undefined while asking, null when no one. */
export function useReader(): Reader | null | undefined {
  const query = useQuery({ queryKey: READER_KEY, queryFn: getReader, staleTime: 5 * 60_000, retry: false });
  return query.isPending ? undefined : query.isError ? null : query.data;
}

/** What the login note needs: which button asked, where it is, and what to finish after logging in. */
export type LoginAsk = { kind: AskKind; anchor: HTMLElement | null; pending: PendingAction | null };

/** Opens the login note (components/account/AccountRuntime) next to the button that asked, or at the bottom. */
export function askToLogIn(kind: AskKind = "any", anchor: HTMLElement | null = null, pending: PendingAction | null = null) {
  window.dispatchEvent(new CustomEvent<LoginAsk>(LOGIN_REQUIRED_EVENT, { detail: { kind, anchor, pending } }));
}

/**
 * Before taking part: true when it needs an account the reader hasn't got, and then the login note is already open,
 * so the caller stops there. While the session is still being checked it lets the action through; the API decides.
 */
export function useAccountGate(): (kind: Exclude<AskKind, "any">, anchor?: HTMLElement | null, pending?: PendingAction) => boolean {
  const reader = useReader();
  return (kind, anchor = null, pending) => {
    const needs = ASK_NEEDS[kind];
    if (reader !== null || (needs !== "account" && !needsAccount(needs))) return false;
    askToLogIn(kind, anchor, pending ?? null);
    return true;
  };
}

/** Whether this kind of taking part is closed to this reader: no account, and one is needed. */
export function useLockedOut(what: Participation): boolean {
  return useReader() === null && needsAccount(what);
}

/** The browser's lists the account replaces (backend: "It replaces reader-prefs, article-votes…"). */
const STORES = [
  "reader-prefs",
  "article-votes",
  "story-importa",
  "comment-likes",
  "ideas-voted",
  "idea-replies-voted",
  "stories-read",
] as const;

let signedIn = false;
let applying = false;

function write(key: (typeof STORES)[number], value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the account still has it; this browser just won't show it.
  }
  window.dispatchEvent(new Event(key));
}

const oldestFirst = <T>(list: T[]) => [...list].reverse();

/** Fills this browser's lists from the account's (lists come newest first; the browser keeps them oldest first). */
export function applyAccountState(state: AccountState) {
  applying = true;
  try {
    replaceReaderPrefs({
      saved: oldestFirst(state.saved.articles),
      hidden: oldestFirst(state.hidden),
      mutedSources: oldestFirst(state.muted.sources),
      mutedParties: oldestFirst(state.muted.parties),
    });
  } finally {
    applying = false;
  }
  const votes: Record<string, number> = { ...state.votes.articles };
  for (const [slug, value] of Object.entries(state.votes.editorial)) votes[`post:${slug}`] = value;
  write("article-votes", JSON.stringify(votes));
  write("story-importa", JSON.stringify(Object.fromEntries(state.votes.stories.map((id) => [id, 1]))));
  write("comment-likes", JSON.stringify(state.votes.comments));
  write("ideas-voted", state.votes.forum.join(","));
  write("idea-replies-voted", state.votes.forumPosts.join(","));
  write("stories-read", JSON.stringify(oldestFirst(state.read)));
  setExtrasFrom(state);
}

/** Empties this browser's lists (on logging out or deleting the account). */
export function clearLocalState() {
  applying = true;
  try {
    replaceReaderPrefs({ saved: [], hidden: [], mutedSources: [], mutedParties: [] });
  } finally {
    applying = false;
  }
  for (const key of STORES) if (key !== "reader-prefs") write(key, null);
  clearExtras();
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

/** What this browser had before logging in, newest first, for POST /me/merge. */
export function localStateToMerge(): MergeInput {
  const prefs = readerPrefs();
  const read = readJson("stories-read");
  return {
    saved: { articles: oldestFirst(prefs.saved), stories: [] },
    hidden: oldestFirst(prefs.hidden),
    muted: { sources: oldestFirst(prefs.mutedSources), parties: oldestFirst(prefs.mutedParties) },
    read: Array.isArray(read) ? oldestFirst(read.filter((id): id is number => Number.isInteger(id))) : [],
  };
}

/** After logging in or creating the account: this browser's lists join the account's, then show the result. */
export async function adoptAccount(client: ReturnType<typeof useQueryClient>, reader: Reader) {
  signedIn = true;
  try {
    applyAccountState(await mergeAccountState(localStateToMerge()));
  } catch {
    // The account works without the merge; the next visit fills the lists from it.
  }
  client.setQueryData(READER_KEY, reader);
}

export async function signOut(client: ReturnType<typeof useQueryClient>) {
  try {
    await logOut();
  } finally {
    forgetAccount(client);
  }
}

/** The session is gone (logged out, deleted, expired): empty the lists and show the logged-out header. */
export function forgetAccount(client: ReturnType<typeof useQueryClient>) {
  // Already forgotten (the session-ended event, then the caller's own error handler): once is enough.
  if (client.getQueryData(READER_KEY) === null && !signedIn) return;
  signedIn = false;
  pulled = null;
  clearLocalState();
  markAccountDevice(false);
  client.setQueryData(READER_KEY, null);
  // Nothing of theirs stays in memory for the next person on this computer (the inbox, picks, saved, activity):
  // every other query goes back to where the page started, and the reader's own ones ask again, now logged out.
  void client.resetQueries({ predicate: (query) => query.queryKey[0] !== READER_KEY[0] });
}

/** Once per page load with a session: the account's lists replace this browser's, so every device shows the same. */
let pulled: { id: number; done: Promise<void> } | null = null;
export function pullAccountState(reader: Reader): Promise<void> {
  signedIn = true;
  // A second caller waits for the same pull, so nothing it does afterwards is overwritten by an older answer.
  if (pulled?.id === reader.id) return pulled.done;
  const done: Promise<void> = getAccountState()
    .then((state) => {
      // Logged out (or someone else in) while it loaded: their lists don't come back.
      if (pulled?.done === done && signedIn) {
        applyAccountState(state);
        markAccountDevice(true);
      }
    })
    .catch(() => {
      if (pulled?.done === done) pulled = null;
    });
  pulled = { id: reader.id, done };
  return done;
}

/**
 * Logged out on load. If this browser held an account's lists (its session ended between visits), they go, as on a
 * logout: the next person on this computer starts clean. A reader who never logged in keeps theirs.
 */
export function markSignedOut() {
  signedIn = false;
  pulled = null;
  if (hadAccount()) {
    clearLocalState();
    markAccountDevice(false);
  }
}

// Whether the lists on this device are an account's (set once they're pulled), so an ended session can clear them.
const ACCOUNT_MARK = "politicando:listas-da-conta";
function hadAccount(): boolean {
  try {
    return window.localStorage.getItem(ACCOUNT_MARK) === "1";
  } catch {
    return false;
  }
}
function markAccountDevice(on: boolean) {
  try {
    if (on) window.localStorage.setItem(ACCOUNT_MARK, "1");
    else window.localStorage.removeItem(ACCOUNT_MARK);
  } catch {
    // Blocked storage: nothing was kept either.
  }
}

const send = (change: ListChange, on: boolean) => {
  if (!signedIn || applying) return;
  changeList(change, on).catch(() => {
    // Kept in this browser; the account catches up at the next change or merge.
  });
};

/** Sends each change to the reader's lists to the account. */
function diff(before: ReaderPrefs, after: ReaderPrefs) {
  const compare = <T>(was: T[], now: T[], change: (value: T) => ListChange) => {
    for (const value of now) if (!was.includes(value)) send(change(value), true);
    for (const value of was) if (!now.includes(value)) send(change(value), false);
  };
  compare(before.saved, after.saved, (id) => ({ list: "saved", kind: "article", id }));
  compare(before.hidden, after.hidden, (id) => ({ list: "hidden", id }));
  compare(before.mutedSources, after.mutedSources, (value) => ({ list: "muted", kind: "source", value }));
  compare(before.mutedParties, after.mutedParties, (value) => ({ list: "muted", kind: "party", value }));
}

if (typeof window !== "undefined") onReaderPrefsChange(diff);

/** A story opened: kept in the account too. */
export const accountMarkRead = (id: number) => send({ list: "read", id }, true);

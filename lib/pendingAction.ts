import type { CommentStance, CommentTarget } from "./types";

/*
 * What the reader was doing when the site asked for an account, kept on this device while they log in, so the page they
 * come back to finishes it for them (components/account/AccountRuntime): the comment is published, the vote counted.
 */

export type PendingAction =
  | { kind: "comment"; target: CommentTarget; parentId: number | null; text: string; stance: CommentStance | null }
  | { kind: "importa"; id: number }
  | { kind: "vote"; id: number; value: 1 | -1 }
  | { kind: "post"; slug: string }
  | { kind: "like"; id: number }
  | { kind: "idea"; id: number }
  /** ▲ on a comment on an idea (a forum post). */
  | { kind: "reply"; id: number };

const KEY = "politicando:depois-de-entrar";
/** Long enough to create an account, short enough not to surprise anyone the next day. */
const MAX_AGE = 60 * 60_000;

type Stored = { path: string; action: PendingAction; at: number };

export function savePending(path: string, action: PendingAction) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ path, action, at: Date.now() } satisfies Stored));
  } catch {
    // Not kept: after logging in the reader does it again.
  }
}

/** The action waiting for this page, taken off the list; an old or another page's one is dropped once it's stale. */
export function takePending(path: string, now = Date.now()): PendingAction | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    const stale = now - stored.at > MAX_AGE;
    if (stored.path !== path && !stale) return null;
    window.localStorage.removeItem(KEY);
    return stale ? null : stored.action;
  } catch {
    return null;
  }
}

/** What a reader without an account wrote in a comment box, kept until it's published. */
const draftKey = (target: CommentTarget, parentId: number | null) => `politicando:rascunho:${target}:${parentId ?? "novo"}`;

export function readDraft(target: CommentTarget, parentId: number | null): string {
  try {
    return window.localStorage.getItem(draftKey(target, parentId)) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(target: CommentTarget, parentId: number | null, text: string) {
  try {
    if (text.trim()) window.localStorage.setItem(draftKey(target, parentId), text);
    else window.localStorage.removeItem(draftKey(target, parentId));
  } catch {
    // Not kept on this device.
  }
}

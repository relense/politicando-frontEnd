"use client";

import { useEffect, useRef } from "react";

/*
 * An API answer reached outside a button (after logging in, the page finishes the vote the reader started), handed to
 * the buttons of that item on the page so their numbers follow.
 */

const EVENT = "politicando:answer";
type Detail = { kind: string; id: number | string; answer: unknown };

export function publishAnswer<T>(kind: string, id: number | string, answer: T) {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { kind, id, answer } }));
}

export function useAnswer<T>(kind: string, id: number | string, onAnswer: (answer: T) => void) {
  const latest = useRef(onAnswer);
  useEffect(() => {
    latest.current = onAnswer;
  });
  useEffect(() => {
    const listen = (event: Event) => {
      const detail = (event as CustomEvent<Detail>).detail;
      if (detail.kind === kind && detail.id === id) latest.current(detail.answer as T);
    };
    window.addEventListener(EVENT, listen);
    return () => window.removeEventListener(EVENT, listen);
  }, [kind, id]);
}

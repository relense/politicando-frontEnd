"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import { sortParties, type PartyOrder } from "@/lib/parties";
import type { Party, PartyStanding } from "@/lib/types";

const STORAGE_KEY = "party-order";
const CHANGE_EVENT = "party-order-change";

// The choice lives in localStorage, which may be missing or blocked: then the order by name stays.
function readOrder(): PartyOrder {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "votes" ? "votes" : "name";
  } catch {
    return "name";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

type Value = { standings: Record<string, PartyStanding>; order: PartyOrder; setOrder: (order: PartyOrder) => void };

const PartyOrderContext = createContext<Value>({ standings: {}, order: "name", setOrder: () => {} });

/** Shares each party's seats and votes, and the reader's choice of order, with every party list on the page. */
export function PartyOrderProvider({ standings, children }: { standings: Record<string, PartyStanding>; children: ReactNode }) {
  // The server and the first render always use the order by name, so the markup matches before the saved choice applies.
  const saved = useSyncExternalStore(subscribe, readOrder, () => "name" as const);
  const available = Object.keys(standings).length > 0;
  const setOrder = useCallback((next: PartyOrder) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved; the change below still applies until the page is left.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const value = useMemo(
    () => ({ standings, order: available ? saved : ("name" as const), setOrder }),
    [standings, available, saved, setOrder],
  );
  return <PartyOrderContext.Provider value={value}>{children}</PartyOrderContext.Provider>;
}

/** The parties in the chosen order, with what to show beside each one when ordered by votes. */
export function useOrderedParties(parties: readonly Party[]) {
  const { standings, order } = useContext(PartyOrderContext);
  const ordered = useMemo(() => sortParties(parties, standings, order), [parties, standings, order]);
  return { ordered, order, standingOf: (slug: string) => (order === "votes" ? standingLabel(standings[slug]) : null) };
}

/** "58 deputados · 22,8%", or "em coligação" for a partner whose votes are the coalition's. */
export function standingLabel(standing: PartyStanding | undefined): string | null {
  if (!standing || (standing.seats === 0 && standing.votes === 0)) return null;
  const seats = standing.seats === 1 ? "1 deputado" : `${standing.seats} deputados`;
  const share = standing.coalition ? "em coligação" : standing.votes > 0 ? formatPercent(standing.validPct) : null;
  return [standing.seats > 0 ? seats : null, share].filter(Boolean).join(" · ");
}

/** "A–Z · Votos". Hidden when there is nothing to order by but the name. */
export function PartyOrderToggle({ className = "" }: { className?: string }) {
  const { standings, order, setOrder } = useContext(PartyOrderContext);
  if (Object.keys(standings).length === 0) return null;
  const button = (value: PartyOrder, label: string, title: string) => (
    <button
      type="button"
      aria-pressed={order === value}
      title={title}
      onClick={() => setOrder(value)}
      className={`rounded px-1.5 py-0.5 ${order === value ? "bg-ink text-paper" : "text-muted hover:bg-surface hover:text-ink"}`}
    >
      {label}
    </button>
  );
  return (
    <span
      role="group"
      aria-label="Ordenar partidos"
      className={`inline-flex items-center gap-0.5 font-mono text-xs normal-case tracking-normal ${className}`}
    >
      <span aria-hidden="true" className="mr-1 text-muted">
        Ordenar
      </span>
      {button("name", "A–Z", "Por ordem alfabética")}
      {button("votes", "Mais votados", "Por deputados e votos nas últimas legislativas")}
    </span>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { embedsAllowed, setEmbedsAllowed, subscribeEmbeds } from "@/lib/consent";

/** Shows and changes the reader's choice about players from other sites. */
export function EmbedsChoice() {
  const allowed = useSyncExternalStore(subscribeEmbeds, embedsAllowed, () => false);
  return (
    <div className="not-prose my-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
      <p role="status" className="text-sm">
        {allowed ? (
          <>
            <b>Carregar sempre</b> está ligado neste navegador: os leitores de outros sites abrem sem perguntar.
          </>
        ) : (
          <>Os leitores de outros sites só carregam quando carregas no botão de cada um.</>
        )}
      </p>
      <button
        type="button"
        onClick={() => setEmbedsAllowed(!allowed)}
        className="rounded-full border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
      >
        {allowed ? "Deixar de carregar automaticamente" : "Carregar sempre"}
      </button>
    </div>
  );
}

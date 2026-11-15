"use client";

import { useState } from "react";
import { getContracts, type ContractQuery, type ContractSummary } from "@/lib/api/contracts";
import { ContractItem } from "./ContractViews";

type Props = { query: ContractQuery; cursor: string | null };

/** The pages after the first, fetched in the browser and added below it. */
export function MoreContracts({ query, cursor: first }: Props) {
  const [items, setItems] = useState<ContractSummary[]>([]);
  const [cursor, setCursor] = useState(first);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function more() {
    if (!cursor) return;
    setState("loading");
    try {
      const page = await getContracts({ ...query, cursor });
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      {items.length > 0 && (
        <ul aria-label="Mais contratos" className="mt-3 space-y-3">
          {items.map((contract) => (
            <ContractItem key={contract.id} contract={contract} />
          ))}
        </ul>
      )}
      <p className="sr-only" aria-live="polite">
        {items.length > 0 ? `${items.length} contratos adicionados` : ""}
      </p>
      {cursor ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={more}
            disabled={state === "loading"}
            className="rounded-full border border-line px-4 py-2 font-mono text-sm font-bold hover:bg-surface disabled:opacity-60"
          >
            {state === "loading" ? "A carregar…" : "Mostrar mais"}
          </button>
          {state === "error" && (
            <p role="alert" className="mt-2 text-sm text-danger">
              Não foi possível carregar mais contratos. Tenta outra vez.
            </p>
          )}
        </div>
      ) : (
        items.length > 0 && <p className="mt-4 text-center text-sm text-muted">Não há mais contratos com estes filtros.</p>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { markSignedOut, pullAccountState, useReader } from "@/lib/account";
import { LOGIN_REQUIRED_EVENT } from "@/lib/api/client";
import { useReturnPath } from "./AccountMenu";

/**
 * On every page: fills this browser's lists from the account once per visit, and when the API answers that taking
 * part needs an account (`login_required`), offers to log in. Renders nothing otherwise.
 */
export function AccountRuntime() {
  const reader = useReader();
  const back = useReturnPath();
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (reader) void pullAccountState(reader);
    else if (reader === null) markSignedOut();
  }, [reader]);

  useEffect(() => {
    const ask = () => setAsked(true);
    window.addEventListener(LOGIN_REQUIRED_EVENT, ask);
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, ask);
  }, []);

  if (!asked || reader) return null;
  const next = back === "/" ? "" : `?depois=${encodeURIComponent(back)}`;
  return (
    <div
      role="alertdialog"
      aria-labelledby="entra-para-participar"
      aria-describedby="entra-para-participar-texto"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-line bg-paper p-5 shadow-xl"
    >
      <p id="entra-para-participar" className="pr-8 text-lg font-bold">
        Entra para participar
      </p>
      <p id="entra-para-participar-texto" className="mt-1 text-sm text-muted">
        Comentar, votar, marcar &quot;Importa&quot; e denunciar pedem uma conta. Ler continua livre. É grátis e só precisa de um nome e uma
        palavra-passe.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/entrar${next}`}
          onClick={() => setAsked(false)}
          className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
        >
          Entrar
        </Link>
        <Link
          href={`/criar-conta${next}`}
          onClick={() => setAsked(false)}
          className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 font-mono text-xs font-bold text-paper hover:opacity-90"
        >
          Criar conta
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setAsked(false)}
        aria-label="Fechar"
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

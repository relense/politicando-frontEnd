"use client";

import Link from "next/link";
import { useReader } from "@/lib/account";
import { useReturnPath } from "@/components/account/AccountMenu";

/** «Entra para votar e propor»: only for readers without an account (reading needs none). */
export function JoinBox() {
  const reader = useReader();
  const back = useReturnPath();
  if (reader !== null) return null;
  const next = back === "/" ? "" : `?depois=${encodeURIComponent(back)}`;
  return (
    <section aria-labelledby="entrar-ideias" className="rounded-2xl border border-line bg-surface p-4">
      <h2 id="entrar-ideias" className="font-bold">
        Entra para votar e propor
      </h2>
      <p className="mt-1 text-sm text-muted">Ler é livre. Votar e propor pede uma conta grátis.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/entrar${next}`}
          className="inline-flex min-h-9 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-paper"
        >
          Entrar
        </Link>
        <Link
          href={`/criar-conta${next}`}
          className="inline-flex min-h-9 items-center rounded-full bg-ink px-4 font-mono text-xs font-bold text-paper hover:opacity-90"
        >
          Criar conta
        </Link>
      </div>
    </section>
  );
}

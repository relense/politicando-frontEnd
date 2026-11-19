"use client";

import Link from "next/link";
import { useReader } from "@/lib/account";
import { SavedArticles } from "../SavedArticles";
import { SavedElsewhere } from "./SavedElsewhere";
import { GOLD, OUTLINE } from "./ui";

const BACK = `?depois=${encodeURIComponent("/guardadas")}`;

/** The saved lists, kept by the account; without one, the way in. */
export function SavedLists() {
  const reader = useReader();
  if (reader === undefined) return <p className="text-muted">A verificar a sessão…</p>;
  if (!reader)
    return (
      <div className="max-w-xl rounded-2xl border border-dashed border-line p-6">
        <h2 className="text-xl font-bold">Entra para guardar</h2>
        <p className="mt-2 text-muted">
          Guardar pede uma conta: o que guardares fica nela, em todos os teus dispositivos. Ler continua livre.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/criar-conta${BACK}`} className={`${GOLD} min-h-10 px-4 text-xs`}>
            Criar conta
          </Link>
          <Link href={`/entrar${BACK}`} className={`${OUTLINE} min-h-10 px-4 text-xs`}>
            Entrar
          </Link>
        </div>
      </div>
    );
  return (
    <>
      <SavedArticles />
      <SavedElsewhere />
    </>
  );
}

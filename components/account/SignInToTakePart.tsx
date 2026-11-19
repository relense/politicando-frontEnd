"use client";

import Link from "next/link";
import { useReturnPath } from "./AccountMenu";

/** In place of a form that needs an account: what it's for, and the way in. */
export function SignInToTakePart({ title, children }: { title: string; children: string }) {
  const back = useReturnPath();
  const next = back === "/" ? "" : `?depois=${encodeURIComponent(back)}`;
  return (
    <div className="rounded-2xl border border-dashed border-line p-5">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/entrar${next}`}
          className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
        >
          Entrar
        </Link>
        <Link
          href={`/criar-conta${next}`}
          className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 font-mono text-xs font-bold text-paper hover:opacity-90"
        >
          Criar conta
        </Link>
      </div>
    </div>
  );
}

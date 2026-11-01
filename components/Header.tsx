"use client";

import Link from "next/link";
import { PartyDrawer } from "./PartyDrawer";
import { ThemeToggle } from "./ThemeToggle";
import { useRef } from "react";
import type { Party } from "@/lib/types";

export function Header({ parties }: { parties: Party[] }) {
  const drawerRef = useRef<HTMLDialogElement>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
        <button
          type="button"
          aria-label="Abrir lista de partidos"
          aria-haspopup="dialog"
          onClick={() => drawerRef.current?.showModal()}
          className="-ml-2 flex size-10 items-center justify-center rounded hover:bg-surface"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/" className="font-mono text-lg font-bold tracking-[0.2em]">
          POLITICANDO
        </Link>
        <ThemeToggle />
      </div>
      <PartyDrawer ref={drawerRef} parties={parties} />
    </header>
  );
}

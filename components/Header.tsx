"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Party } from "@/lib/types";
import { PartyDrawer } from "./PartyDrawer";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ parties }: { parties: Party[] }) {
  const drawerRef = useRef<HTMLDialogElement>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[2.5rem_1fr_2.5rem] items-center px-4">
        {/* Desktop has the party sidebar, so the drawer is only for smaller screens. */}
        <button
          type="button"
          aria-label="Abrir lista de partidos"
          aria-haspopup="dialog"
          onClick={() => drawerRef.current?.showModal()}
          className="-ml-2 flex size-10 items-center justify-center rounded hover:bg-surface lg:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/" className="col-start-2 justify-self-center font-mono text-lg font-bold tracking-[0.2em]">
          POLITICANDO
        </Link>
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </div>
      <PartyDrawer ref={drawerRef} parties={parties} />
    </header>
  );
}

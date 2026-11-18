"use client";

import Link from "next/link";
import { useRef } from "react";
import { PartyDrawer } from "./PartyDrawer";
import { AccountMenu } from "./account/AccountMenu";

export function Header() {
  const drawerRef = useRef<HTMLDialogElement>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto grid h-14 w-full max-w-[96rem] grid-cols-[1fr_auto_1fr] items-center px-4">
        {/* Desktop has the sections column, so the menu is only for smaller screens. */}
        <button
          type="button"
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          onClick={() => drawerRef.current?.showModal()}
          className="-ml-2 flex size-10 items-center justify-center justify-self-start rounded hover:bg-surface lg:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/" className="col-start-2 justify-self-center font-logo text-lg font-bold tracking-[0.2em]">
          {/* The first letter in the icon's gold, as on the browser tab. */}
          <span className="text-brand">P</span>OLITICANDO
        </Link>
        <div className="col-start-3 flex items-center gap-2 justify-self-end">
          {/* Desktop has the sections column; phones have the menu. */}
          <Link href="/parlamento" className="hidden rounded px-2 py-1.5 font-mono text-sm font-bold hover:bg-surface sm:block lg:hidden">
            Parlamento
          </Link>
          {/* The account (the theme moved into its menu, and into the sections menu without one). */}
          <AccountMenu />
        </div>
      </div>
      <PartyDrawer ref={drawerRef} />
    </header>
  );
}

"use client";

import { useLinkStatus } from "next/link";
import { useFormStatus } from "react-dom";

/**
 * Inside a filter link: marks the page while the next list comes (the server can take seconds).
 * Takes no room: the section shows «A carregar…» and dims the list from it (`data-pending`, see LoadingNote).
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span data-pending hidden /> : null;
}

/** The search's button: «A filtrar…» while the next list comes. */
export function FilterButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-pending={pending || undefined}
      aria-disabled={pending || undefined}
      className="rounded-full border border-ink bg-ink px-4 py-2 font-mono text-xs font-bold text-paper aria-disabled:opacity-70"
    >
      {pending ? "A filtrar…" : "Filtrar"}
    </button>
  );
}

/** Over the top of the list, shown only while a filter is pending. */
export function LoadingNote() {
  return (
    <p
      role="status"
      className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto hidden w-fit items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 font-mono text-xs font-bold shadow-sm group-has-[[data-pending]]/list:flex"
    >
      <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-line border-t-ink" />A carregar as propostas…
    </p>
  );
}

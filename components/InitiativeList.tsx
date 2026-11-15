"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getInitiatives, type InitiativeQuery } from "@/lib/api/client";
import type { InitiativePage } from "@/lib/types";
import { InitiativeItem } from "./InitiativeItem";

/** The filtered list, starting from the page the server rendered, with "Mostrar mais" for the next ones. */
export function InitiativeList({ query, initialPage }: { query: Omit<InitiativeQuery, "cursor">; initialPage: InitiativePage }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError } = useInfiniteQuery({
    queryKey: ["initiatives", "list", query],
    queryFn: ({ pageParam }) => getInitiatives({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
  });
  const items = data.pages.flatMap((page) => page.initiatives);

  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Não há iniciativas com estes filtros.</p>;
  }
  return (
    <>
      <ul aria-label="Iniciativas" className="flex flex-col">
        {items.map((initiative) => (
          <li key={initiative.id}>
            <InitiativeItem initiative={initiative} heading="h2" />
          </li>
        ))}
      </ul>
      {isError && (
        <p role="alert" className="mt-4 text-sm text-muted">
          Não foi possível carregar mais iniciativas.
        </p>
      )}
      {hasNextPage && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full border border-line px-5 py-2 font-mono text-sm font-bold hover:bg-surface disabled:opacity-60"
          >
            {isFetchingNextPage ? "A carregar…" : "Mostrar mais"}
          </button>
        </div>
      )}
    </>
  );
}

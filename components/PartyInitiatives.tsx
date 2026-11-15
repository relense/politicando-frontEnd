"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getInitiatives } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/parliament";
import type { InitiativePage } from "@/lib/types";

type Props = { slug: string; acronym: string; initialPage: InitiativePage | null; compact?: boolean };

/** Initiatives the party signed, newest first. */
export function PartyInitiatives({ slug, acronym, initialPage, compact = false }: Props) {
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["initiatives", "party", slug],
    queryFn: ({ pageParam }) => getInitiatives({ party: slug, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialData: initialPage ? { pages: [initialPage], pageParams: [undefined] } : undefined,
  });

  if (isPending) return <p className="text-sm text-muted">A carregar iniciativas…</p>;
  if (isError) return <p className="text-sm text-muted">Não foi possível carregar as iniciativas.</p>;
  const all = data.pages.flatMap((page) => page.initiatives);
  const shown = compact ? all.slice(0, 2) : all;
  if (shown.length === 0) return <p className="text-sm text-muted">O {acronym} ainda não assinou iniciativas nesta legislatura.</p>;

  return (
    <>
      <ul className="divide-y divide-line">
        {shown.map((item) => (
          <li key={item.id} className="py-3">
            <p className="font-mono text-[11px] text-muted">
              {item.type}
              {item.number && ` n.º ${item.number}`} · <span className="font-bold text-ink">{STATUS_LABELS[item.status]}</span>
              {!compact && item.submittedAt && ` · ${formatDate(item.submittedAt)}`}
            </p>
            <p className={`leading-snug ${compact ? "line-clamp-3 text-sm" : "font-bold"}`}>
              {item.textUrl ? (
                <a href={item.textUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {item.title}
                  <span className="sr-only"> (abre num novo separador)</span>
                </a>
              ) : (
                item.title
              )}
            </p>
          </li>
        ))}
      </ul>
      {!compact && hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-4 rounded-full border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
        >
          {isFetchingNextPage ? "A carregar…" : "Mostrar mais"}
        </button>
      )}
    </>
  );
}

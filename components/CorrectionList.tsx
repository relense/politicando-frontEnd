import Link from "next/link";
import type { Correction, CorrectionStatus } from "@/lib/api/feedback";
import { formatDate } from "@/lib/format";

const STATUS: Record<CorrectionStatus, { label: string; color: string }> = {
  fixed: { label: "Corrigido", color: "var(--stage-approved)" },
  checking: { label: "A verificar", color: "var(--stage-debate)" },
  rejected: { label: "Não confirmado", color: "var(--muted)" },
};

/** Corrections, newest first: what was wrong, where, and whether it is fixed. */
export function CorrectionList({ items, compact = false }: { items: Correction[]; compact?: boolean }) {
  return (
    <ol className={compact ? "divide-y divide-line" : "divide-y divide-line rounded-2xl border border-line"}>
      {items.map((item) => {
        const status = STATUS[item.status];
        return (
          <li key={item.id} className={compact ? "py-2.5" : "p-4"}>
            <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
              <span
                className="rounded px-1.5 py-0.5 font-bold"
                style={{ color: status.color, backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)` }}
              >
                {status.label}
              </span>
              <time dateTime={item.date}>{formatDate(item.date)}</time>
              {item.area && <span>· {item.area}</span>}
            </p>
            <p className={`mt-1 font-bold leading-snug ${compact ? "text-sm" : ""}`}>
              {item.url ? (
                item.url.startsWith("/") ? (
                  <Link href={item.url} className="hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.title}
                    <span className="sr-only"> (abre num novo separador)</span>
                  </a>
                )
              ) : (
                item.title
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

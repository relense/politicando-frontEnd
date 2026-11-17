import Link from "next/link";
import type { DebatedTag } from "@/lib/api/stories";
import { formatNumber } from "@/lib/format";

/**
 * "Em debate": the subjects of the last days' stories, most commented first, as hashtags. Each one filters the feed
 * (`?tema=oe2027`); the one chosen is marked and its × shows everything again.
 */
export function DebatedTags({ tags, active, hrefOf }: { tags: DebatedTag[]; active: string; hrefOf: (slug: string | null) => string }) {
  if (tags.length === 0) return null;
  return (
    <nav aria-label="Em debate" className="mb-3 flex items-center gap-3">
      <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Em debate</span>
      <ul className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto max-sm:-mr-4 max-sm:pr-4">
        {tags.map((tag) => {
          const on = tag.slug === active;
          return (
            <li key={tag.slug} className="shrink-0">
              <Link
                href={hrefOf(on ? null : tag.slug)}
                aria-current={on ? "true" : undefined}
                title={tag.name}
                className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 font-mono text-xs ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--card-line)] bg-[var(--inset)] hover:border-[var(--card-line-strong)]"
                }`}
              >
                <b>#{tag.label}</b>
                <span className={on ? "" : "text-muted"}>
                  {formatNumber(tag.comments)} {tag.comments === 1 ? "comentário" : "comentários"}
                </span>
                {on && <span aria-label="Mostrar tudo">×</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

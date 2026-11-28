import Link from "next/link";
import { KIND_LABELS as AGENDA_KINDS, type AgendaItem } from "@/lib/agenda";
import { editorialPath, KIND_LABELS, readingLabel } from "@/lib/editorial";
import { formatDayHeading, formatTime } from "@/lib/format";
import type { EditorialPost } from "@/lib/types";

/** Between the news on a phone: our blog's highlight, as one compact row with a gold edge. */
export function BlogRow({ post }: { post: EditorialPost }) {
  const reading = readingLabel(post);
  return (
    <section
      aria-labelledby="destaque-blog-feed"
      className="relative my-2 flex items-center gap-3 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--marker)_60%,var(--line))] bg-[color-mix(in_srgb,var(--marker)_14%,transparent)] px-4 py-3.5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--brand)] sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[color:var(--stage-debate)]">
          Destaque · Blog <span className="font-normal normal-case tracking-normal text-muted">· {KIND_LABELS[post.kind]}</span>
        </p>
        <h2 id="destaque-blog-feed" className="mt-1 font-bold leading-snug">
          <Link prefetch={false} href={editorialPath(post.slug)} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>
        {reading && <p className="mt-1 font-mono text-[11px] text-muted">{reading}</p>}
      </div>
      <span aria-hidden="true" className="font-mono text-lg text-[color:var(--stage-debate)]">
        →
      </span>
    </section>
  );
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** Between the news on a phone: the next event in the political calendar, as one row with a date badge. */
export function EventRow({ item, now }: { item: AgendaItem; now: number }) {
  const kind = AGENDA_KINDS[item.kind];
  const start = item.allDay ? `${item.start.slice(0, 10)}T12:00:00Z` : item.start;
  const date = new Date(start);
  // The day and month in Lisbon, for the badge.
  const [day, month] = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "numeric" })
    .format(date)
    .split("/")
    .map(Number);
  const when = formatDayHeading(start, now);
  const time = item.allDay ? null : formatTime(item.start);
  return (
    <section
      aria-labelledby="proximo-evento-feed"
      className="relative my-2 flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5 sm:px-5"
    >
      <span
        aria-hidden="true"
        className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-line py-1 font-mono leading-none"
        style={{ backgroundColor: `color-mix(in srgb, ${kind.color} 12%, transparent)` }}
      >
        <span className="text-[10px] font-bold" style={{ color: kind.color }}>
          {MONTHS[(month ?? 1) - 1]}
        </span>
        <span className="mt-0.5 text-lg font-bold">{day}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted">
          Próximo evento ·{" "}
          <time dateTime={item.start}>
            {when}
            {time ? ` · ${time}` : ""}
          </time>
        </p>
        <h2 id="proximo-evento-feed" className="mt-0.5 font-bold leading-snug">
          <Link prefetch={false} href={`/agenda#evento-${item.id}`} className="after:absolute after:inset-0">
            {item.title}
          </Link>
        </h2>
        {item.place && (
          <p className="truncate text-sm text-muted">{[item.place.name, item.place.municipality].filter(Boolean).join(", ")}</p>
        )}
      </div>
      <span className="relative z-10 shrink-0 font-mono text-xs font-bold">
        <Link prefetch={false} href="/agenda" className="hover:underline">
          Agenda <span aria-hidden="true">→</span>
        </Link>
      </span>
    </section>
  );
}

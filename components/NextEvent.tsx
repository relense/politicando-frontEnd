import Link from "next/link";
import { KIND_LABELS, type AgendaItem } from "@/lib/agenda";
import { formatDayHeading, formatTime } from "@/lib/format";

/** The front page's box for the political calendar: the next event, and the way to the rest. */
export function NextEvent({ item, now, headingId = "proximo-evento" }: { item: AgendaItem; now: number; headingId?: string }) {
  const kind = KIND_LABELS[item.kind];
  const day = formatDayHeading(item.allDay ? `${item.start.slice(0, 10)}T12:00:00Z` : item.start, now);
  const time = item.allDay ? null : formatTime(item.start);
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-line p-4"
      style={{ backgroundColor: `color-mix(in srgb, ${kind.color} 10%, transparent)` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: kind.color }}>
          Próximo evento
        </p>
        <span className="font-mono text-xs text-muted">{kind.label}</span>
      </div>
      <h2 id={headingId} className="mt-2 text-xl font-bold leading-snug">
        <Link href={`/agenda#evento-${item.id}`} className="hover:underline">
          {item.title}
        </Link>
      </h2>
      <p className="mt-2 font-mono text-xs">
        <time dateTime={item.start} className="font-bold">
          {day}
          {time ? ` · ${time}` : ""}
        </time>
        {item.status === "postponed" && <span className="ml-2 text-[var(--stage-debate)]">Adiado</span>}
      </p>
      {item.place && <p className="mt-1 text-sm text-muted">{[item.place.name, item.place.municipality].filter(Boolean).join(", ")}</p>}
      <div className="mt-3 flex items-center justify-between gap-2 font-mono text-xs">
        {item.attend.open ? <span className="font-bold text-[var(--stage-approved)]">Aberto ao público</span> : <span />}
        <Link href="/agenda" className="font-bold hover:underline">
          Ver a agenda <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

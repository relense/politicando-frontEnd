"use client";

import { useState } from "react";
import type { EventKind, LegislatureEvent } from "@/lib/api/legislatures";
import { formatLongDate } from "@/lib/format";

export const EVENT_LABELS: Record<EventKind, { one: string; many: string; color: string }> = {
  law: { one: "Lei", many: "Leis e reformas", color: "var(--stage-law)" },
  policy: { one: "Medida", many: "Medidas", color: "var(--stage-submitted)" },
  crisis: { one: "Crise", many: "Crises", color: "var(--stage-stopped)" },
  controversy: { one: "Polémica", many: "Polémicas", color: "var(--end-censure)" },
  economy: { one: "Economia", many: "Economia", color: "var(--stage-debate)" },
  international: { one: "Internacional", many: "Internacional", color: "var(--stage-president)" },
  society: { one: "Sociedade", many: "Sociedade", color: "var(--stage-approved)" },
};

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "7 de novembro de 2023", or only "novembro de 2023" / "2023" when that is all that is known. */
export function eventDate(event: Pick<LegislatureEvent, "date" | "precision">): string {
  const [year, month] = event.date.split("-");
  if (event.precision === "year") return year!;
  if (event.precision === "month") return `${MONTHS[Number(month) - 1]} de ${year}`;
  return formatLongDate(event.date.slice(0, 10)) ?? event.date;
}

/** What happened in a legislature, oldest first, with a filter by kind and the sources under each event. */
export function LegislatureEvents({ events }: { events: LegislatureEvent[] }) {
  const [kind, setKind] = useState<EventKind | null>(null);
  const kinds = (Object.keys(EVENT_LABELS) as EventKind[]).filter((item) => events.some((event) => event.kind === item));
  const shown = events.filter((event) => !kind || event.kind === kind);
  const chip = (pressed: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold ${
      pressed ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
    }`;

  return (
    <>
      {kinds.length > 1 && (
        <div role="group" aria-label="Mostrar" className="mb-5 flex flex-wrap gap-2">
          <button type="button" aria-pressed={kind === null} onClick={() => setKind(null)} className={chip(kind === null)}>
            Tudo <span className="font-normal opacity-70">{events.length}</span>
          </button>
          {kinds.map((item) => (
            <button key={item} type="button" aria-pressed={kind === item} onClick={() => setKind(item)} className={chip(kind === item)}>
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: EVENT_LABELS[item].color }} />
              {EVENT_LABELS[item].many}
              <span className="font-normal opacity-70">{events.filter((event) => event.kind === item).length}</span>
            </button>
          ))}
        </div>
      )}
      <ol className="relative border-l-2 border-line pl-6">
        {shown.map((event) => {
          const label = event.kind ? EVENT_LABELS[event.kind] : null;
          return (
            <li key={`${event.date}-${event.title}`} className="relative pb-7 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute -left-[1.95rem] top-1 size-3.5 rounded-full border-2 border-paper"
                style={{ backgroundColor: label?.color ?? "var(--muted)" }}
              />
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
                <time dateTime={event.date.slice(0, event.precision === "year" ? 4 : event.precision === "month" ? 7 : 10)}>
                  {eventDate(event)}
                </time>
                {label && (
                  <span
                    className="rounded px-1.5 py-0.5 font-bold"
                    style={{ color: label.color, backgroundColor: `color-mix(in srgb, ${label.color} 14%, transparent)` }}
                  >
                    {label.one}
                  </span>
                )}
                {event.judicial && <span className="rounded border border-line px-1.5 py-0.5 font-bold text-ink">Processo judicial</span>}
              </p>
              <h3 className="mt-1 text-lg font-bold leading-snug">{event.title}</h3>
              {/* Shown whole: for a judicial case it says where the case stands, and on what date. */}
              {event.summary && <p className="mt-1 max-w-3xl leading-relaxed">{event.summary}</p>}
              {event.sources.length > 0 && (
                <p className="mt-2 font-mono text-[11px] text-muted">
                  {event.sources.length === 1 ? "Fonte: " : "Fontes: "}
                  {event.sources.map((source, index) => (
                    <span key={source.url}>
                      {index > 0 && ", "}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={source.title ?? undefined}
                        className="text-link underline"
                      >
                        {source.publisher ?? source.title ?? new URL(source.url).host}
                        <span className="sr-only"> (abre num novo separador)</span>
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

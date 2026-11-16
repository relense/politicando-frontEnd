"use client";

import { toIcs, type AgendaItem } from "@/lib/agenda";

/** Downloads the event as a calendar file, which phones and calendar apps open to add it. */
export function AddToCalendar({ item, pageUrl, className = "" }: { item: AgendaItem; pageUrl: string; className?: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([toIcs(item, pageUrl)], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.id}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button type="button" onClick={download} className={className}>
      <span aria-hidden="true">＋ </span>Adicionar ao calendário
    </button>
  );
}

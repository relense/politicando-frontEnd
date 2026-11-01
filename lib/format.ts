const formatter = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fixed timezone, so server and browser render the same text. */
export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}-${parts.month}-${parts.year} | ${parts.hour}:${parts.minute}`;
}

export function excerpt(content: string, length = 210): string {
  if (content.length <= length) return content;
  return `${content.slice(0, length).trimEnd()}…`;
}

export function commentsLabel(count: number): string {
  if (count === 0) return "Comentários";
  return count === 1 ? "1 Comentário" : `${count} Comentários`;
}

export function repliesLabel(count: number): string {
  return count === 1 ? "1 resposta" : `${count} respostas`;
}

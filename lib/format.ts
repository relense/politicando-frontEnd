const LISBON = "Europe/Lisbon";
const dateTimeFormatter = new Intl.DateTimeFormat("pt-PT", {
  timeZone: LISBON,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parts(date: Date): Record<string, string> {
  return Object.fromEntries(dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
}

/** Fixed timezone, so server and browser render the same text. */
export function formatDateTime(value: string | null | undefined): string | null {
  const date = parse(value);
  if (!date) return null;
  const p = parts(date);
  return `${p.day}-${p.month}-${p.year} | ${p.hour}:${p.minute}`;
}

export function formatDate(value: string | null | undefined): string | null {
  const date = parse(value);
  if (!date) return null;
  const p = parts(date);
  return `${p.day}-${p.month}-${p.year}`;
}

/** "há 5 min", "há 3 h", "há 2 dias"; a plain date after a week. */
export function formatRelative(value: string | null | undefined, now: number): string | null {
  const date = parse(value);
  if (!date) return null;
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "há 1 dia" : `há ${days} dias`;
  return formatDate(value);
}

export function excerpt(content: string, length = 210): string {
  if (content.length <= length) return content;
  return `${content.slice(0, length).trimEnd()}…`;
}

export function commentsLabel(count: number): string {
  if (count === 0) return "Comentários";
  return count === 1 ? "1 Comentário" : `${count} Comentários`;
}

/** The feed link invites the first comment instead of announcing none. */
export function commentLinkLabel(count: number): string {
  return count === 0 ? "Comentar" : commentsLabel(count);
}

export function repliesLabel(count: number): string {
  return count === 1 ? "1 resposta" : `${count} respostas`;
}

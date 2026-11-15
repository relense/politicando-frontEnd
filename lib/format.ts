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

const longFormatter = new Intl.DateTimeFormat("pt-PT", {
  timeZone: LISBON,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Sábado, 14 de novembro de 2026, 17:59", for the article page. */
export function formatLongDateTime(value: string | null | undefined): string | null {
  const date = parse(value);
  if (!date) return null;
  const p = Object.fromEntries(longFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = p.weekday!.charAt(0).toUpperCase() + p.weekday!.slice(1);
  return `${weekday}, ${p.day} de ${p.month} de ${p.year}, ${p.hour}:${p.minute}`;
}

const dayFormatter = new Intl.DateTimeFormat("pt-PT", {
  timeZone: LISBON,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function dayParts(date: Date): Record<string, string> {
  return Object.fromEntries(dayFormatter.formatToParts(date).map((part) => [part.type, part.value]));
}

/** The Lisbon calendar day, as "2026-11-14", for grouping the feed by day. */
export function lisbonDay(value: string | null | undefined): string | null {
  const date = parse(value);
  if (!date) return null;
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "Hoje · sábado, 14 de novembro", "Ontem · …", or just the date; the year only when it isn't this year. */
export function formatDayHeading(value: string | null | undefined, now: number): string | null {
  const date = parse(value);
  if (!date) return null;
  const p = dayParts(date);
  const today = lisbonDay(new Date(now).toISOString());
  const yesterday = lisbonDay(new Date(now - 86_400_000).toISOString());
  const day = lisbonDay(value);
  const label = `${p.weekday}, ${p.day} de ${p.month}${p.year !== dayParts(new Date(now)).year ? ` de ${p.year}` : ""}`;
  if (day === today) return `Hoje · ${label}`;
  if (day === yesterday) return `Ontem · ${label}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "19:38" in Lisbon time, for items already grouped by day. */
export function formatTime(value: string | null | undefined): string | null {
  const date = parse(value);
  if (!date) return null;
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

/** "5 de junho de 2025", for dates such as when a Government took office. Date-only values are read as such. */
export function formatLongDate(value: string | null | undefined): string | null {
  // "2025-06-05" would be midnight UTC; noon keeps it on the same day in Lisbon.
  const date = parse(value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  if (!date) return null;
  const p = dayParts(date);
  return `${p.day} de ${p.month} de ${p.year}`;
}

const numberFormatter = new Intl.NumberFormat("pt-PT");
const percentFormatter = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "1 971 558", with Portuguese grouping. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** "32,5%". */
export function formatPercent(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : `${percentFormatter.format(value)}%`;
}

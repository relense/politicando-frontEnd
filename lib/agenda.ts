/** The political calendar: kinds, districts and the calendar file, shared by the page and its buttons. */

export const AGENDA_KINDS = [
  "parliament",
  "committee",
  "government",
  "president",
  "party",
  "local",
  "election",
  "european",
  "other",
] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];

export const KIND_LABELS: Record<AgendaKind, { label: string; plural: string; color: string }> = {
  parliament: { label: "Parlamento", plural: "Parlamento", color: "var(--stage-approved)" },
  committee: { label: "Comissão parlamentar", plural: "Comissões", color: "var(--stage-law)" },
  government: { label: "Governo", plural: "Governo", color: "var(--stage-submitted)" },
  president: { label: "Presidente", plural: "Presidente", color: "var(--stage-president)" },
  party: { label: "Partido", plural: "Partidos", color: "var(--stage-debate)" },
  local: { label: "Autarquia", plural: "Autarquias", color: "var(--end-censure)" },
  election: { label: "Eleições", plural: "Eleições", color: "var(--stage-stopped)" },
  european: { label: "União Europeia", plural: "União Europeia", color: "var(--link)" },
  other: { label: "Outro", plural: "Outros", color: "var(--muted)" },
};

export const isAgendaKind = (value: string): value is AgendaKind => (AGENDA_KINDS as readonly string[]).includes(value);

/** The districts and the autonomous regions, as the API names them in `place.district`. */
export const DISTRICTS = [
  "Aveiro",
  "Beja",
  "Braga",
  "Bragança",
  "Castelo Branco",
  "Coimbra",
  "Évora",
  "Faro",
  "Guarda",
  "Leiria",
  "Lisboa",
  "Portalegre",
  "Porto",
  "Santarém",
  "Setúbal",
  "Viana do Castelo",
  "Vila Real",
  "Viseu",
  "Açores",
  "Madeira",
] as const;

export type AgendaPlace = {
  name: string;
  address: string | null;
  municipality: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
};

export type AgendaItem = {
  id: string;
  kind: AgendaKind;
  title: string;
  summary: string | null;
  /** An instant with its offset, or a bare day when `allDay`. */
  start: string;
  end: string | null;
  allDay: boolean;
  status: "scheduled" | "cancelled" | "postponed";
  place: AgendaPlace | null;
  /** Where to watch it live, such as ARTV or a party's channel. */
  online: { url: string; label: string | null } | null;
  /** Whether anyone can go, and how (registration, ID at the door, seats limited). */
  attend: { open: boolean; how: string | null; url: string | null };
  organizer: string | null;
  parties: { slug: string; acronym: string }[];
  sourceUrl: string | null;
  /** Chosen by the editors for the front page's box. */
  featured: boolean;
};

/** Where an all-day item ends in a calendar file: the next day, as the format counts it. */
const nextDay = (day: string) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const icsDay = (day: string) => day.slice(0, 10).replaceAll("-", "");
const icsInstant = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const icsText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");

/** One event as an iCalendar file, for "Adicionar ao calendário". */
export function toIcs(item: AgendaItem, pageUrl: string, now = new Date()): string {
  const where = item.place ? [item.place.name, item.place.address, item.place.municipality].filter(Boolean).join(", ") : null;
  const notes = [item.summary, item.attend.how, item.online?.url ? `Em direto: ${item.online.url}` : null, pageUrl]
    .filter(Boolean)
    .join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Politicando//Agenda//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${item.id}@politicando.pt`,
    `DTSTAMP:${icsInstant(now.toISOString())}`,
    ...(item.allDay
      ? [
          `DTSTART;VALUE=DATE:${icsDay(item.start)}`,
          `DTEND;VALUE=DATE:${icsDay(item.end ? nextDay(item.end.slice(0, 10)) : nextDay(item.start.slice(0, 10)))}`,
        ]
      : [`DTSTART:${icsInstant(item.start)}`, ...(item.end ? [`DTEND:${icsInstant(item.end)}`] : [])]),
    `SUMMARY:${icsText(item.title)}`,
    ...(where ? [`LOCATION:${icsText(where)}`] : []),
    ...(notes ? [`DESCRIPTION:${icsText(notes)}`] : []),
    `URL:${pageUrl}`,
    ...(item.status === "cancelled" ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/** A map link for a place: its coordinates when known, else its address. */
export function mapUrl(place: AgendaPlace): string {
  if (place.lat !== null && place.lng !== null) {
    return `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`;
  }
  const query = [place.name, place.address, place.municipality].filter(Boolean).join(", ");
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

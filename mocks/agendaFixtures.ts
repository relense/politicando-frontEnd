import { http, HttpResponse } from "msw";

const API = "*/api/v2";

/** A day from today, in Lisbon, as "2026-11-20". */
const day = (offset: number) => {
  const date = new Date(Date.now() + offset * 86_400_000);
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
};
/** An instant on that day at that Lisbon hour (winter or summer, the offset is close enough for a mock). */
const at = (offset: number, time: string) => new Date(`${day(offset)}T${time}:00Z`).toISOString();

/** Fictional events, always in the coming days, in the shape of the contract in docs/api-handoff.md. */
const items = () => [
  {
    id: "plenario-1",
    kind: "parliament",
    title: "Debate quinzenal com o Primeiro-Ministro",
    summary: "Henrique Valadares responde às perguntas dos grupos parlamentares.",
    start: at(1, "15:00"),
    end: at(1, "18:00"),
    allDay: false,
    status: "scheduled",
    place: {
      name: "Assembleia da República",
      address: "Palácio de São Bento",
      municipality: "Lisboa",
      district: "Lisboa",
      lat: 38.7134,
      lng: -9.1563,
    },
    online: { url: "https://example.com/canal-parlamento", label: "Canal Parlamento" },
    attend: { open: true, how: "Galerias abertas ao público, com documento de identificação.", url: null },
    organizer: "Assembleia da República",
    parties: [],
    sourceUrl: "https://example.com/agenda-parlamento",
    featured: true,
  },
  {
    id: "camara-porto",
    kind: "local",
    title: "Reunião pública da Câmara Municipal do Porto",
    summary: "Ordem de trabalhos com o orçamento municipal; período aberto à intervenção do público.",
    start: at(2, "10:00"),
    end: null,
    allDay: false,
    status: "scheduled",
    place: {
      name: "Paços do Concelho",
      address: "Praça General Humberto Delgado",
      municipality: "Porto",
      district: "Porto",
      lat: null,
      lng: null,
    },
    online: null,
    attend: { open: true, how: "Inscrição prévia para intervir, até à véspera.", url: "https://example.com/inscricao" },
    organizer: "Câmara Municipal do Porto",
    parties: [],
    sourceUrl: null,
    featured: false,
  },
  {
    id: "congresso-ps",
    kind: "party",
    title: "Congresso Nacional do PS",
    summary: null,
    start: day(5),
    end: day(7),
    allDay: true,
    status: "scheduled",
    place: { name: "Centro de Congressos", address: null, municipality: "Coimbra", district: "Coimbra", lat: null, lng: null },
    online: null,
    attend: { open: false, how: "Só para delegados; as sessões de abertura e encerramento passam em direto.", url: null },
    organizer: "Partido Socialista",
    parties: [{ slug: "ps", acronym: "PS" }],
    sourceUrl: "https://example.com/congresso",
    featured: false,
  },
  {
    id: "conselho-ministros",
    kind: "government",
    title: "Conselho de Ministros",
    summary: "Reunião semanal; o comunicado sai no fim.",
    start: at(3, "10:00"),
    end: null,
    allDay: false,
    status: "cancelled",
    place: null,
    online: null,
    attend: { open: false, how: null, url: null },
    organizer: "Governo",
    parties: [],
    sourceUrl: null,
    featured: false,
  },
];

export const agendaHandlers = [
  http.get(`${API}/agenda`, ({ request }) => {
    const url = new URL(request.url);
    const kinds = (url.searchParams.get("kind") ?? "").split(",").filter(Boolean);
    const district = url.searchParams.get("district");
    const open = url.searchParams.get("open") === "true";
    const matching = items()
      .filter((item) => kinds.length === 0 || kinds.includes(item.kind))
      .filter((item) => !district || item.place?.district === district)
      .filter((item) => !open || item.attend.open)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const limit = Number(url.searchParams.get("limit") ?? 50);
    return HttpResponse.json({ items: matching.slice(0, limit), nextCursor: null, total: matching.length });
  }),
];

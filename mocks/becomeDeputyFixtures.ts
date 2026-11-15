import { http, HttpResponse } from "msw";
import type { ApiCandidatesInput, ApiDhondtInput, ApiExplainerInput } from "@/lib/api/becomeDeputy";

/** "How to become a deputy" for the mock API: short made-up text, two círculos, and fictional candidates. */

const API = "*/api/v2";
const ELECTION = { id: "legislativas-2025", type: "legislativas", name: "Legislativas 2025", date: "2025-05-18", organs: ["AR"] };

export const explainer: ApiExplainerInput = {
  title: "Como se chega a deputado",
  reviewedAt: "2026-11-15",
  sections: [
    {
      id: "quem-pode",
      title: "Quem pode ser deputado",
      body: ["Qualquer cidadão português maior de idade e recenseado."],
      sources: [{ label: "Constituição, art. 150.º", url: "https://example.com/constituicao" }],
    },
    { id: "partidos", title: "Só os partidos apresentam listas", body: ["As listas são dos partidos."], sources: [] },
    {
      id: "circulos",
      title: "Os círculos",
      body: ["Cada círculo elege um número de deputados proporcional aos eleitores."],
      sources: [{ label: "Lei Eleitoral", url: null }],
    },
    { id: "listas-fechadas", title: "Vota-se numa lista, não numa pessoa", body: ["Os lugares vão para os primeiros nomes."], sources: [] },
    { id: "dhondt", title: "O método de Hondt", body: ["Os votos dividem-se por 1, 2, 3…"], sources: [] },
    { id: "paridade", title: "Paridade", body: ["As listas alternam homens e mulheres."], sources: [] },
    { id: "substituicoes", title: "Quem sai é substituído", body: ["Entra o seguinte da mesma lista."], sources: [] },
    { id: "mandato", title: "O mandato", body: ["Dura quatro anos, salvo dissolução."], sources: [] },
  ],
  circles: {
    election: "legislativas-2025",
    items: [
      { key: "LOCAL-110000", name: "Lisboa", seats: 48 },
      { key: "LOCAL-010000", name: "Aveiro", seats: 16 },
      { key: "LOCAL-120000", name: "Portalegre", seats: 2 },
    ],
  },
};

const PLACES = {
  "LOCAL-120000": { key: "LOCAL-120000", name: "Portalegre", level: "district", dicofre: "12" },
  "LOCAL-110000": { key: "LOCAL-110000", name: "Lisboa", level: "district", dicofre: "11" },
} as const;

const quotients = (votes: number, count: number) =>
  Array.from({ length: count }, (_, index) => Math.round((votes / (index + 1)) * 100) / 100);

function dhondt(key: keyof typeof PLACES): ApiDhondtInput {
  const small = key === "LOCAL-120000";
  const seats = small ? 2 : 48;
  const lists = small
    ? [
        { list: "CH", name: "CHEGA", partySlugs: ["chega"], votes: 17000, seats: 1, votesShortOfNextSeat: 15000 },
        { list: "PS", name: "Partido Socialista", partySlugs: ["ps"], votes: 16000, seats: 1, votesShortOfNextSeat: 18000 },
        {
          list: "PPD/PSD.CDS-PP",
          name: "AD - COLIGAÇÃO PSD/CDS",
          partySlugs: ["psd", "cds-pp"],
          votes: 15500,
          seats: 0,
          votesShortOfNextSeat: 501,
        },
        { list: "IL", name: "Iniciativa Liberal", partySlugs: ["il"], votes: 1100, seats: 0, votesShortOfNextSeat: 14900 },
      ]
    : [
        {
          list: "PPD/PSD.CDS-PP",
          name: "AD - COLIGAÇÃO PSD/CDS",
          partySlugs: ["psd", "cds-pp"],
          votes: 400000,
          seats: 17,
          votesShortOfNextSeat: 9000,
        },
        { list: "PS", name: "Partido Socialista", partySlugs: ["ps"], votes: 300000, seats: 12, votesShortOfNextSeat: 2300 },
        { list: "CH", name: "CHEGA", partySlugs: ["chega"], votes: 250000, seats: 10, votesShortOfNextSeat: 4000 },
        { list: "IL", name: "Iniciativa Liberal", partySlugs: ["il"], votes: 120000, seats: 5, votesShortOfNextSeat: 6000 },
        { list: "L", name: "LIVRE", partySlugs: ["livre"], votes: 90000, seats: 4, votesShortOfNextSeat: 3000 },
      ];
  return {
    election: ELECTION,
    organ: "AR",
    place: PLACES[key],
    seats,
    simulated: false,
    matchesOfficial: true,
    lastSeat: small ? { list: "PS", quotient: 16000 } : { list: "L", quotient: 22500 },
    firstLoser: small ? { list: "PPD/PSD.CDS-PP", quotient: 15500 } : { list: "PS", quotient: 23076.92 },
    lists: lists.map((item) => ({ ...item, officialSeats: item.seats, quotients: quotients(item.votes, seats) })),
  } as ApiDhondtInput;
}

const NAMES = ["Rita Valente", "Duarte Moniz", "Inês Carvalhal", "Nuno Albergaria", "Sofia Tavares", "Hugo Ramalho", "Marta Seixas"];

function candidates(key: keyof typeof PLACES): ApiCandidatesInput {
  const person = (list: number, position: number, elected: boolean, deputyId: number | null) => ({
    position,
    name: `${NAMES[(list + position) % NAMES.length]} ${["Fictício", "Exemplo", "Teste"][list % 3]}`,
    elected,
    deputyId,
  });
  const lists =
    key === "LOCAL-120000"
      ? [
          { list: "CH", name: "CHEGA", partySlugs: ["chega"], seats: 1 },
          { list: "PS", name: "Partido Socialista", partySlugs: ["ps"], seats: 1 },
          { list: "PPD/PSD.CDS-PP", name: "AD - COLIGAÇÃO PSD/CDS", partySlugs: ["psd", "cds-pp"], seats: 0 },
        ]
      : [
          { list: "PPD/PSD.CDS-PP", name: "AD - COLIGAÇÃO PSD/CDS", partySlugs: ["psd", "cds-pp"], seats: 17 },
          { list: "PS", name: "Partido Socialista", partySlugs: ["ps"], seats: 12 },
        ];
  return {
    election: ELECTION,
    place: PLACES[key],
    circles: Object.values(PLACES),
    lists: lists.map((item, index) => ({
      ...item,
      // The first elected went to the Government (no deputy record); the second below the line took the seat.
      candidates: Array.from({ length: item.seats + 3 }, (_, at) =>
        person(
          index,
          at + 1,
          at < item.seats,
          at === 0 && index === 1 ? null : at === item.seats + 1 && index === 1 ? 1002 : at < item.seats ? 1001 : null,
        ),
      ),
      alternates: Array.from({ length: 2 }, (_, at) => person(index + 4, at + 1, false, null)),
    })),
  };
}

const known = (key: string | null): key is keyof typeof PLACES => key !== null && key in PLACES;

export const becomeDeputyHandlers = [
  http.get(`${API}/explainers/become-deputy`, () => HttpResponse.json(explainer)),
  http.get(`${API}/elections/:id/dhondt`, ({ request }) => {
    const place = new URL(request.url).searchParams.get("place");
    return known(place)
      ? HttpResponse.json(dhondt(place))
      : HttpResponse.json({ error: { code: "not_found", message: "x" } }, { status: 404 });
  }),
  http.get(`${API}/elections/:id/candidates`, ({ request }) => {
    const place = new URL(request.url).searchParams.get("place");
    return known(place)
      ? HttpResponse.json(candidates(place))
      : HttpResponse.json({ error: { code: "not_found", message: "x" } }, { status: 404 });
  }),
];

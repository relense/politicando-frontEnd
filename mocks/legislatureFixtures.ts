import { http, HttpResponse } from "msw";

const API = "*/api/v2";

/** Two legislatures with fictional people and events, in the shape of docs/legislatures-api.md. */
const SUMMARIES = [
  {
    id: "XVII",
    name: "XVII Legislatura",
    start: "2025-06-03",
    end: null,
    current: true,
    elections: ["legislativas-2025"],
    primeMinisters: ["Henrique Valadares"],
    initiatives: 120,
    events: 2,
  },
  {
    id: "III",
    name: "III Legislatura",
    start: "1983-05-31",
    end: "1985-11-04",
    current: false,
    elections: [],
    primeMinisters: ["Rui Carvalhal"],
    initiatives: 40,
    events: 1,
  },
];

const government = (code: string, name: string, primeMinister: string, start: string, end: string | null) => ({
  code,
  kind: "constitutional",
  name,
  primeMinister,
  start,
  end,
  days: 500,
  parties: [{ slug: "psd", acronym: "PSD", name: "Partido Social Democrata" }],
  support: null,
  endReason: end ? "censure" : null,
  endNote: null,
  portalUrl: null,
  current: end === null,
});

const DETAILS: Record<string, unknown> = {
  XVII: {
    ...SUMMARIES[0],
    elections: [
      {
        id: "legislativas-2025",
        name: "Legislativas 2025",
        date: "2025-05-18",
        totalMandates: 230,
        seats: [
          { list: "PSD", name: "Partido Social Democrata", partySlugs: ["psd"], votes: 1000000, mandates: 120 },
          { list: "PS", name: "Partido Socialista", partySlugs: ["ps"], votes: 900000, mandates: 100 },
          { list: "UDP", name: "União Democrática Popular", partySlugs: [], votes: 10000, mandates: 10 },
        ],
      },
    ],
    governments: [government("gc25", "XXV Governo Constitucional", "Henrique Valadares", "2025-06-05", null)],
    presidents: [{ id: "presidente-ficticio", name: "Amélia Sotto Maior", termStart: "2021-03-09", termEnd: null }],
    initiatives: {
      submitted: 120,
      approved: 30,
      rejected: 50,
      withdrawn: 5,
      pending: 35,
      laws: 12,
      byAuthor: [
        { key: "ps", name: "PS", partySlug: "ps", submitted: 60, approved: 10, rejected: 30, withdrawn: 2, pending: 18 },
        { key: "governo", name: "Governo", partySlug: null, submitted: 20, approved: 15, rejected: 0, withdrawn: 0, pending: 5 },
      ],
    },
    events: [
      {
        date: "2025-09-01",
        precision: "month",
        kind: "law",
        judicial: false,
        title: "Lei fictícia da habitação aprovada",
        summary: "Um acontecimento inventado para os testes.",
        sources: [{ url: "https://example.com/lei", title: "Notícia", publisher: "Jornal Exemplo" }],
      },
      {
        date: "2025-11-07",
        precision: "day",
        kind: "controversy",
        judicial: true,
        title: "Caso fictício no ministério",
        summary: "Em novembro de 2025 havia dois arguidos e nenhuma acusação.",
        sources: [
          { url: "https://example.com/caso", title: "Caso", publisher: "Jornal Exemplo" },
          { url: "https://example.org/caso", title: "Caso", publisher: "Rádio Exemplo" },
        ],
      },
    ],
    cases: [],
  },
  III: {
    ...SUMMARIES[1],
    elections: [],
    governments: [government("gc09", "IX Governo Constitucional", "Rui Carvalhal", "1983-06-09", "1985-11-06")],
    presidents: [],
    initiatives: { submitted: 40, approved: 10, rejected: 10, withdrawn: 0, pending: 20, laws: 5, byAuthor: [] },
    events: [
      {
        date: "1984-01-01",
        precision: "year",
        kind: "economy",
        judicial: false,
        title: "Acordo fictício com credores",
        summary: "Outro acontecimento inventado.",
        sources: [{ url: "https://example.com/1984", title: null, publisher: null }],
      },
    ],
    cases: [],
  },
};

export const legislatureHandlers = [
  http.get(`${API}/legislatures`, () => HttpResponse.json({ items: SUMMARIES })),
  http.get(`${API}/legislatures/:id`, ({ params }) => {
    const detail = DETAILS[String(params.id)];
    return detail
      ? HttpResponse.json(detail)
      : HttpResponse.json({ error: { code: "not_found", message: "Legislature not found" } }, { status: 404 });
  }),
];

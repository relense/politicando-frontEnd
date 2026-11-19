import { http, HttpResponse } from "msw";

const API = "*/api/v2";
const SOURCE = "https://www.parlamento.pt/Cidadania/Paginas/DAOE.aspx";

/** A day from today, in Lisbon, as "2026-11-20". */
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });

const PARTIES = {
  psd: { slug: "psd", acronym: "PSD", name: "Partido Social Democrata" },
  chega: { slug: "chega", acronym: "CH", name: "Chega" },
  ps: { slug: "ps", acronym: "PS", name: "Partido Socialista" },
  il: { slug: "il", acronym: "IL", name: "Iniciativa Liberal" },
  livre: { slug: "livre", acronym: "L", name: "LIVRE" },
  pcp: { slug: "pcp", acronym: "PCP", name: "Partido Comunista Português" },
  "cds-pp": { slug: "cds-pp", acronym: "CDS-PP", name: "CDS - Partido Popular" },
  be: { slug: "be", acronym: "BE", name: "Bloco de Esquerda" },
  pan: { slug: "pan", acronym: "PAN", name: "Pessoas-Animais-Natureza" },
  jpp: { slug: "jpp", acronym: "JPP", name: "Juntos pelo Povo" },
} as const;
type Slug = keyof typeof PARTIES;
// The source's order: by seats.
const ORDER: Slug[] = ["psd", "chega", "ps", "il", "livre", "pcp", "cds-pp", "be", "pan", "jpp"];
type Choice = "favor" | "against" | "abstention" | "absent";

/** Each group's own line, in the source's order; `apart` adds a (fictional) deputy voting apart from their group. */
const lines = (votes: Partial<Record<Slug, Choice>>, apart?: { slug: Slug; deputy: string; vote: Choice }) => {
  const own = ORDER.filter((slug) => votes[slug]).map((slug) => ({
    party: PARTIES[slug],
    group: PARTIES[slug].name,
    deputy: null,
    vote: votes[slug]!,
  }));
  return apart
    ? [
        ...own,
        { party: PARTIES[apart.slug], group: `${apart.deputy}(${PARTIES[apart.slug].acronym})`, deputy: apart.deputy, vote: apart.vote },
      ]
    : own;
};

const vote = (
  votedOn: string,
  result: "approved" | "rejected" | "superseded" | null,
  parties: ReturnType<typeof lines>,
  extra: object = {},
) => ({
  votedOn,
  phase: "committee",
  result,
  unanimous: false,
  label: result === "approved" ? "Aprovado(a) em Comissão" : result === "rejected" ? "Rejeitado(a) em Comissão" : null,
  partLabel: result === "approved" ? "Aprovado(a)" : result === "rejected" ? "Rejeitado(a)" : null,
  parts: [],
  subject: null,
  parties,
  ambiguous: false,
  ambiguity: null,
  ...extra,
});

const RIGHT_FOR: Partial<Record<Slug, Choice>> = {
  psd: "favor",
  chega: "against",
  ps: "abstention",
  il: "favor",
  livre: "against",
  pcp: "against",
  "cds-pp": "favor",
  be: "against",
  pan: "abstention",
  jpp: "favor",
};
const LEFT_FOR: Partial<Record<Slug, Choice>> = {
  psd: "against",
  chega: "against",
  ps: "favor",
  il: "against",
  livre: "favor",
  pcp: "favor",
  "cds-pp": "against",
  be: "favor",
  pan: "favor",
  jpp: "abstention",
};

const proposal = (fields: {
  id: number;
  year?: number;
  number: string;
  title: string;
  article?: string | null;
  topics: string[];
  result: string;
  status: string;
  authors: Slug[];
  deputies?: string[];
  submittedOn?: string;
  votes?: ReturnType<typeof vote>[];
  resultPhase?: string | null;
  plain?: string;
}) => ({
  id: fields.id,
  year: fields.year ?? 2027,
  number: fields.number,
  title: fields.title,
  article: fields.article ?? null,
  topics: fields.topics,
  target: "articles",
  kind: "Substituição",
  status: fields.status,
  result: fields.result,
  resultPhase: fields.resultPhase ?? (fields.votes?.length ? "committee" : null),
  unanimous: false,
  authors: {
    parties: fields.authors.map((slug) => PARTIES[slug]),
    deputies: fields.deputies ?? [],
    label: fields.authors.map((slug) => PARTIES[slug].acronym).join(", ") || (fields.deputies ?? []).join(", "),
  },
  submittedOn: fields.submittedOn ?? "2026-11-06",
  lastVotedOn: fields.votes?.length ? fields.votes[fields.votes.length - 1]!.votedOn : null,
  plain: fields.plain ? { summary: fields.plain, automatic: true, updatedAt: "2026-11-19T12:00:00.000Z" } : null,
  documentUrl: `https://example.com/oe/${fields.id}.pdf`,
  sourceUrl: SOURCE,
  votes: fields.votes ?? [],
});

/** Fictional proposals in the contract's shape (docs/budget-api.md in the backend repo); votes on today's date, so "today" always has some. */
export const budgetProposals = () => [
  proposal({
    id: 28301,
    number: "1260C",
    title: "Artigo 9.º do Código do IRS",
    article: "Artigo 9.º",
    topics: ["IRS"],
    result: "approved",
    status: "Aprovado(a) em Comissão",
    authors: ["psd"],
    plain: "Muda os escalões do IRS Jovem para quem tem até 35 anos.",
    votes: [vote(day(0), "approved", lines(RIGHT_FOR, { slug: "psd", deputy: "Rui Valadares", vote: "against" }))],
  }),
  proposal({
    id: 28302,
    number: "1271C",
    title: "Artigo 2.º do Código do IMI",
    article: "Artigo 2.º",
    topics: ["Habitação"],
    result: "rejected",
    status: "Rejeitado(a) em Comissão",
    authors: ["ps"],
    votes: [vote(day(0), "rejected", lines(LEFT_FOR))],
  }),
  proposal({
    id: 28303,
    number: "1302C",
    title: "Verba 1.4 da Lista I anexa ao Código do IVA",
    topics: ["IVA"],
    result: "partially_approved",
    status: "Aprovado(a) parcialmente em Comissão",
    authors: ["livre", "pan"],
    votes: [
      vote(day(0), "approved", lines({ ...LEFT_FOR, psd: "favor" }), { parts: ["Alínea a), N.º 1"], partLabel: "Aprovado(a)" }),
      vote(day(0), "rejected", lines(LEFT_FOR), { parts: ["Alínea b), N.º 1"], partLabel: "Rejeitado(a)" }),
    ],
  }),
  proposal({
    id: 28304,
    number: "991C",
    title: "Artigo 4.º · Comissão de reembolso antecipado no crédito à habitação",
    article: "Artigo 4.º",
    topics: ["Habitação"],
    result: "approved",
    status: "Aprovado(a) em Comissão",
    authors: ["ps"],
    votes: [vote(day(-1), "approved", lines({ ...LEFT_FOR, psd: "favor", "cds-pp": "favor" }))],
  }),
  proposal({
    id: 28305,
    number: "1360C",
    title: "Artigo 112.º · Fundo Ambiental",
    article: "Artigo 112.º",
    topics: ["Ambiente"],
    result: "rejected",
    status: "Rejeitado(a) em Comissão",
    authors: ["be"],
    // The source names a group nobody recognises: the vote is kept, flagged, never guessed.
    votes: [
      vote(day(-1), "rejected", lines(LEFT_FOR), {
        ambiguous: true,
        ambiguity: "Grupo desconhecido na fonte oficial",
      }),
    ],
  }),
  proposal({
    id: 28306,
    number: "1450C",
    title: "Artigo 87.º do Código do IRC",
    article: "Artigo 87.º",
    topics: ["IRC"],
    result: "pending",
    status: "Por votar",
    authors: ["il"],
  }),
  proposal({
    id: 28307,
    number: "1505C",
    title: "Artigo 21.º · Escalões do IRS Jovem",
    article: "Artigo 21.º",
    topics: ["IRS"],
    result: "sent_to_plenary",
    status: "Avocada pelo Plenário",
    authors: ["chega"],
  }),
  proposal({
    id: 28308,
    number: "1522C",
    title: "Artigo 140.º · Serviço Nacional de Saúde",
    article: "Artigo 140.º",
    topics: ["Saúde"],
    result: "pending",
    status: "Por votar",
    authors: ["pcp"],
  }),
];

const bill = (year: number, initiativeId: number, status: string, votes: object[], number = "110") => ({
  initiativeId,
  legislature: "XVII",
  number,
  title: `Orçamento do Estado para ${year}`,
  status,
  votes,
});
const headline = (date: string, phase: string, result: string, favor: Slug[], against: Slug[], abstention: Slug[]) => ({
  date,
  phase,
  result,
  favor: favor.map((party) => ({ party, count: null })),
  against: against.map((party) => ({ party, count: null })),
  abstention: abstention.map((party) => ({ party, count: null })),
  absent: [],
  named: [],
});

const bills2027 = () => [
  bill(2027, 377352, "in_progress", [
    headline(
      "2026-10-31",
      "Votação na generalidade",
      "Aprovado",
      ["psd", "cds-pp"],
      ["chega", "livre", "pcp", "be", "pan", "jpp"],
      ["ps", "il"],
    ),
  ]),
];
const bills2026 = [
  bill(
    2026,
    360100,
    "approved",
    [
      headline(
        "2025-10-30",
        "Votação na generalidade",
        "Aprovado",
        ["psd", "cds-pp"],
        ["chega", "livre", "pcp", "be", "pan", "jpp"],
        ["ps", "il"],
      ),
      headline(
        "2025-11-28",
        "Votação final global",
        "Aprovado",
        ["psd", "cds-pp"],
        ["chega", "livre", "pcp", "be", "pan", "jpp"],
        ["ps", "il"],
      ),
    ],
    "35",
  ),
];
const bills2005 = [
  bill(
    2005,
    20050,
    "approved",
    [headline("2004-11-30", "Votação final global", "Aprovado", ["psd", "cds-pp"], ["ps", "pcp", "be"], [])],
    "142",
  ),
];

const counts = (items: ReturnType<typeof budgetProposals>) => {
  const voted = items.filter((item) => item.votes.length > 0).length;
  return { proposals: items.length, voted, pending: items.length - voted };
};

const budgetYears = () => {
  const items = budgetProposals();
  return [
    { year: 2027, ...counts(items), lastVotedOn: day(0), syncedAt: new Date(Date.now() - 12 * 60_000).toISOString(), bills: bills2027() },
    { year: 2026, proposals: 3, voted: 3, pending: 0, lastVotedOn: "2025-11-25", syncedAt: "2025-11-28T12:00:00.000Z", bills: bills2026 },
    { year: 2005, proposals: 0, voted: 0, pending: 0, lastVotedOn: null, syncedAt: null, bills: bills2005 },
  ];
};

const past2026 = () => [
  proposal({
    id: 26001,
    year: 2026,
    number: "12C",
    title: "Artigo 5.º do Código do IVA",
    topics: ["IVA"],
    result: "approved",
    status: "Aprovado(a) em Comissão",
    authors: ["psd"],
    votes: [vote("2025-11-25", "approved", lines(RIGHT_FOR))],
  }),
  proposal({
    id: 26002,
    year: 2026,
    number: "40C",
    title: "Artigo 30.º · Propinas",
    topics: ["Educação"],
    result: "rejected",
    status: "Rejeitado(a) em Comissão",
    authors: ["be"],
    votes: [vote("2025-11-24", "rejected", lines(LEFT_FOR))],
  }),
  proposal({
    id: 26003,
    year: 2026,
    number: "77C",
    title: "Artigo 8.º · Passe ferroviário",
    topics: ["Transportes"],
    result: "approved",
    status: "Aprovado(a) em Comissão",
    authors: ["livre"],
    votes: [vote("2025-11-24", "approved", lines({ ...LEFT_FOR, psd: "favor" }))],
  }),
];

const proposalsOf = (year: number) => (year === 2027 ? budgetProposals() : year === 2026 ? past2026() : []);

const RESULT_KEYS = [
  "pending",
  "sent_to_plenary",
  "approved",
  "partially_approved",
  "rejected",
  "withdrawn",
  "not_admitted",
  "superseded",
  "unclear",
];

/** Totals worked out from the fixtures, as the API does: optionally only the votes in some days. */
function summaryOf(year: number, votedFrom: string | null, votedTo: string | null) {
  const inDays = (date: string | null) => !!date && (!votedFrom || date >= votedFrom) && (!votedTo || date <= votedTo);
  const days = votedFrom || votedTo;
  const items = proposalsOf(year)
    .map((item) => ({ ...item, votes: days ? item.votes.filter((entry) => inDays(entry.votedOn)) : item.votes }))
    .filter((item) => !days || item.votes.length > 0);
  const results = Object.fromEntries(RESULT_KEYS.map((key) => [key, items.filter((item) => item.result === key).length]));
  const parties = ORDER.map((slug) => {
    const own = items.filter((item) => item.authors.parties.some((party) => party.slug === slug));
    const others = { favor: 0, against: 0, abstention: 0, absent: 0 };
    for (const item of items)
      if (!own.includes(item))
        for (const entry of item.votes)
          for (const line of entry.parties) if (line.party?.slug === slug && !line.deputy) others[line.vote as Choice]++;
    return {
      party: PARTIES[slug],
      proposals: own.length,
      results: Object.fromEntries(RESULT_KEYS.map((key) => [key, own.filter((item) => item.result === key).length])),
      votesOnOthers: others,
    };
  });
  const topics = [...new Set(items.flatMap((item) => item.topics))].map((topic) => ({
    topic,
    proposals: items.filter((item) => item.topics.includes(topic)).length,
  }));
  const year2027 = year === 2027;
  return {
    year,
    votedFrom,
    votedTo,
    proposals: items.length,
    votes: items.reduce((sum, item) => sum + item.votes.length, 0),
    ambiguousVotes: items.reduce((sum, item) => sum + item.votes.filter((entry) => entry.ambiguous).length, 0),
    results,
    parties,
    topics,
    lastVotedOn: budgetYears().find((item) => item.year === year)?.lastVotedOn ?? null,
    syncedAt: budgetYears().find((item) => item.year === year)?.syncedAt ?? null,
    bills: budgetYears().find((item) => item.year === year)?.bills ?? [],
    // Only while votes are left, and not on a day's summary.
    schedule:
      year2027 && !days
        ? [
            {
              id: "ar-1",
              title: "Comissão de Orçamento, Finanças e Administração Pública",
              kind: "committee",
              startsAt: new Date(Date.now() - 60_000).toISOString(),
              allDay: false,
            },
            {
              id: "ar-2",
              title: "Discussão de artigos remetidos a Plenário e normas avocadas",
              kind: "parliament",
              startsAt: `${day(1)}T10:00:00.000Z`,
              allDay: false,
            },
            {
              id: "ar-3",
              title: "Comissão de Orçamento, Finanças e Administração Pública",
              kind: "committee",
              startsAt: `${day(2)}T15:00:00.000Z`,
              allDay: false,
            },
          ]
        : [],
    sourceUrl: SOURCE,
  };
}

const ascii = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const budgetHandlers = [
  http.get(`${API}/budget`, () => HttpResponse.json({ items: budgetYears(), sourceUrl: SOURCE })),
  http.get(`${API}/budget/:year/summary`, ({ params, request }) => {
    const year = Number(params.year);
    if (!budgetYears().some((item) => item.year === year)) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const search = new URL(request.url).searchParams;
    return HttpResponse.json(summaryOf(year, search.get("votedFrom"), search.get("votedTo")));
  }),
  http.get(`${API}/budget/:year/proposals/:id`, ({ params }) => {
    const item = proposalsOf(Number(params.year)).find((entry) => entry.id === Number(params.id));
    return item ? HttpResponse.json(item) : HttpResponse.json({ error: "not_found" }, { status: 404 });
  }),
  http.get(`${API}/budget/:year/proposals`, ({ params, request }) => {
    const search = new URL(request.url).searchParams;
    const party = search.get("party");
    const results = search.get("result")?.split(",").filter(Boolean) ?? [];
    const topic = search.get("topic");
    const q = search.get("q");
    const from = search.get("votedFrom");
    const to = search.get("votedTo");
    let items = proposalsOf(Number(params.year)).filter(
      (item) =>
        (!party || item.authors.parties.some((entry) => entry.slug === party)) &&
        (results.length === 0 || results.includes(item.result)) &&
        (!topic || item.topics.includes(topic)) &&
        (!q || ascii(`${item.number} ${item.title} ${item.article ?? ""} ${item.topics.join(" ")}`).includes(ascii(q))) &&
        (!(from || to) || item.votes.some((entry) => (!from || entry.votedOn >= from) && (!to || entry.votedOn <= to))),
    );
    if (search.get("sort") === "number") items = [...items].sort((a, b) => a.number.localeCompare(b.number, "pt", { numeric: true }));
    else items = [...items].sort((a, b) => (b.lastVotedOn ?? "").localeCompare(a.lastVotedOn ?? ""));
    const limit = Number(search.get("limit") ?? 20);
    const start = Number(search.get("cursor") ?? 0);
    const page = items.slice(start, start + limit);
    return HttpResponse.json({ items: page, nextCursor: start + limit < items.length ? String(start + limit) : null, total: items.length });
  }),
];

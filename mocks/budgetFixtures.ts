import { http, HttpResponse } from "msw";
import { articles } from "./fixtures";

const API = "*/api/v2";
const SOURCE = "https://www.parlamento.pt/Cidadania/Paginas/DAOE.aspx";
/** «Depois da votação»: a fictional announcement and its source, as the team would record it (docs/budget-api.md, "After the vote"). */
const ANNOUNCEMENT = "https://exemplo.pt/governo-normas-orcamento";
const afterVote2027 = [
  {
    date: "2026-11-26",
    text: "O Governo anunciou que não vai aplicar uma norma aprovada, sobre a comissão de reembolso antecipado no crédito à habitação, invocando a lei-travão.",
    sourceName: "Jornal de Exemplo",
    sourceUrl: ANNOUNCEMENT,
    proposalIds: [28304],
  },
];
const COMMITTEE_SCRIPT = "https://example.com/oe/guiao-comissao.pdf";
const PLENARY_SCRIPT = "https://example.com/oe/guiao-plenario.pdf";

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

/** The voting scripts (docs/budget-api.md, "What's voted on which day"): today in committee, in order; tomorrow in the plenary. */
const scripts = () => [
  { date: day(0), venue: "committee", scriptUrl: COMMITTEE_SCRIPT, ids: [28301, 28302, 28306, 28308] },
  { date: day(1), venue: "plenary", scriptUrl: PLENARY_SCRIPT, ids: [28307] },
];
const scheduledOf = (id: number) =>
  scripts().flatMap((script) =>
    script.ids.includes(id)
      ? [{ date: script.date, venue: script.venue, position: script.ids.indexOf(id) + 1, scriptUrl: script.scriptUrl }]
      : [],
  );

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
  news?: { id: number; title: string; source: string; url: string; publishedAt: string }[];
  implementation?: { status: string; date: string; note: string | null; sourceName: string; sourceUrl: string };
  statements?: {
    party: { slug: string; acronym: string; name: string } | null;
    speaker: string | null;
    text: string;
    articleId: number;
    articleTitle: string;
    source: string;
    publishedAt: string;
  }[];
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
  scheduled: scheduledOf(fields.id),
  news: fields.news ?? [],
  statements: fields.statements ?? [],
  implementation: fields.implementation ?? null,
});

/** A mock article, as «Nas notícias» names it (mocks/fixtures.ts). */
const newsOf = (id: number) => {
  const item = articles.find((entry) => entry.id === id)!;
  return { id, title: item.title, source: item.source, url: item.url!, publishedAt: item.publishedAt };
};

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
    news: [newsOf(100), newsOf(98)],
    statements: [
      {
        party: PARTIES.psd,
        speaker: "Rui Valadares",
        text: "Diz que os mais novos ficam com «mais rendimento disponível».",
        articleId: 100,
        articleTitle: newsOf(100).title,
        source: newsOf(100).source,
        publishedAt: newsOf(100).publishedAt,
      },
      {
        party: PARTIES.ps,
        speaker: null,
        text: "«A medida chega a poucos jovens.»",
        articleId: 98,
        articleTitle: newsOf(98).title,
        source: newsOf(98).source,
        publishedAt: newsOf(98).publishedAt,
      },
      {
        party: null,
        speaker: "Teresa Amaral",
        text: "Uma voz sem partido indicado: fica de fora.",
        articleId: 98,
        articleTitle: newsOf(98).title,
        source: newsOf(98).source,
        publishedAt: newsOf(98).publishedAt,
      },
    ],
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
    implementation: {
      status: "not_applied",
      date: "2026-11-26",
      note: "O Governo invoca a lei-travão.",
      sourceName: "Jornal de Exemplo",
      sourceUrl: ANNOUNCEMENT,
    },
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
    // A long topic, as the parliament names some: it once pushed the page past a phone's width.
    topics: ["Saúde", "Orçamento, Finanças e Administração Pública"],
    result: "pending",
    status: "Por votar",
    authors: ["pcp"],
  }),
  // Withdrawn before any vote: neither voted nor still to vote, so the top counts name it to add up.
  proposal({
    id: 28309,
    number: "1530C",
    title: "Artigo 12.º · Taxas moderadoras",
    article: "Artigo 12.º",
    topics: ["Saúde"],
    result: "withdrawn",
    status: "Retirada",
    authors: ["ps"],
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
      // Taken from the news before the parliament's open data has it (docs/budget-api.md).
      {
        ...headline(
          "2025-11-28",
          "Votação final global",
          "Aprovado",
          ["psd", "cds-pp"],
          ["chega", "livre", "pcp", "be", "pan", "jpp"],
          ["ps", "il"],
        ),
        provisional: true,
        source: { name: "Jornal de Exemplo", url: "https://exemplo.pt/orcamento-aprovado" },
      },
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
    {
      year: 2027,
      ...counts(items),
      lastVotedOn: day(0),
      syncedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      bills: bills2027(),
      afterVote: afterVote2027,
    },
    {
      year: 2026,
      proposals: 4,
      voted: 3,
      pending: 1,
      lastVotedOn: "2025-11-25",
      syncedAt: "2025-11-28T12:00:00.000Z",
      bills: bills2026,
      afterVote: [],
    },
    { year: 2005, proposals: 0, voted: 0, pending: 0, lastVotedOn: null, syncedAt: null, bills: bills2005, afterVote: [] },
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
  // Called up to the plenary, its result not published yet when the final vote came (docs/budget-api.md).
  proposal({
    id: 26004,
    year: 2026,
    number: "91C",
    title: "Artigo 12.º · Abono de família",
    topics: ["Segurança Social"],
    result: "sent_to_plenary",
    status: "Avocado(a)",
    authors: ["ps"],
    votes: [],
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
              stage: "committee",
              startsAt: new Date(Date.now() - 60_000).toISOString(),
              endsAt: null,
              allDay: false,
              started: true,
            },
            {
              id: "ar-2",
              title: "Discussão de artigos remetidos a Plenário e normas avocadas",
              kind: "parliament",
              stage: "plenary",
              startsAt: `${day(1)}T10:00:00.000Z`,
              endsAt: null,
              allDay: false,
              started: false,
            },
            {
              id: "ar-3",
              title: "Comissão de Orçamento, Finanças e Administração Pública",
              kind: "committee",
              stage: "committee",
              startsAt: `${day(2)}T15:00:00.000Z`,
              endsAt: null,
              allDay: false,
              started: false,
            },
            {
              id: "ar-4",
              title: "Encerramento do debate na especialidade e votação final global",
              kind: "parliament",
              stage: "final_vote",
              startsAt: `${day(5)}T10:00:00.000Z`,
              endsAt: null,
              allDay: false,
              started: false,
            },
          ]
        : [],
    votingDays:
      year2027 && !days
        ? scripts().map((script) => {
            const planned = items.filter((item) => script.ids.includes(item.id));
            const still = planned.filter((item) => item.result === "pending" || item.result === "sent_to_plenary");
            return { date: script.date, venue: script.venue, proposals: planned.length, pending: still.length };
          })
        : [],
    afterVote: budgetYears().find((item) => item.year === year)?.afterVote ?? [],
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
    const scheduledOn = search.get("scheduledOn");
    const implementation = search.get("implementation");
    if (search.get("sort") === "scheduled" && !scheduledOn) return HttpResponse.json({ error: "scheduled_on_required" }, { status: 400 });
    let items = proposalsOf(Number(params.year)).filter(
      (item) =>
        (!party || item.authors.parties.some((entry) => entry.slug === party)) &&
        (results.length === 0 || results.includes(item.result)) &&
        (!topic || item.topics.includes(topic)) &&
        (!q || ascii(`${item.number} ${item.title} ${item.article ?? ""} ${item.topics.join(" ")}`).includes(ascii(q))) &&
        (!(from || to) || item.votes.some((entry) => (!from || entry.votedOn >= from) && (!to || entry.votedOn <= to))) &&
        (!scheduledOn || item.scheduled.some((entry) => entry.date === scheduledOn)) &&
        (!implementation || item.implementation?.status === implementation),
    );
    // The day's scripts' order: committee first, then the plenary.
    const placeOn = (item: (typeof items)[number]) => {
      const entry = item.scheduled.find((planned) => planned.date === scheduledOn)!;
      return (entry.venue === "committee" ? 0 : 10_000) + entry.position;
    };
    if (search.get("sort") === "scheduled") items = [...items].sort((a, b) => placeOn(a) - placeOn(b));
    else if (search.get("sort") === "number") items = [...items].sort((a, b) => a.number.localeCompare(b.number, "pt", { numeric: true }));
    else items = [...items].sort((a, b) => (b.lastVotedOn ?? "").localeCompare(a.lastVotedOn ?? ""));
    const limit = Number(search.get("limit") ?? 20);
    const start = Number(search.get("cursor") ?? 0);
    // The list sends only «O que muda»: news and statements come with the single proposal.
    const page = items.slice(start, start + limit).map((item) => ({ ...item, news: undefined, statements: undefined }));
    return HttpResponse.json({ items: page, nextCursor: start + limit < items.length ? String(start + limit) : null, total: items.length });
  }),
];
